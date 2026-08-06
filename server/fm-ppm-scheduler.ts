import { pool } from "./db";

const LOOKAHEAD_DAYS = 7;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const targetMonth = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().split("T")[0];
}

function rollForward(currentDate: string, frequency: string, intervalDays: number | null): string {
  switch ((frequency || "monthly").toLowerCase()) {
    case "daily":
      return addDays(currentDate, intervalDays && intervalDays > 0 ? intervalDays : 1);
    case "weekly":
      return addDays(currentDate, intervalDays && intervalDays > 0 ? intervalDays : 7);
    case "monthly":
      return addMonths(currentDate, 1);
    case "quarterly":
      return addMonths(currentDate, 3);
    case "annual":
    case "annually":
    case "yearly":
      return addMonths(currentDate, 12);
    case "custom":
      return addDays(currentDate, intervalDays && intervalDays > 0 ? intervalDays : 30);
    default:
      if (intervalDays && intervalDays > 0) return addDays(currentDate, intervalDays);
      return addMonths(currentDate, 1);
  }
}

function fmSlaHoursForPpm(priority: string): number | null {
  switch ((priority || "medium").toLowerCase()) {
    case "critical": return 4;
    case "high": return 8;
    case "medium": return 24;
    case "low": return 72;
    default: return 24;
  }
}

function computeSlaDueAt(scheduledDate: string, scheduledStartTime?: string | null): Date | null {
  const hours = fmSlaHoursForPpm("medium");
  if (hours == null) return null;
  const base = new Date(`${scheduledDate}T${scheduledStartTime || "09:00"}:00`);
  return new Date(base.getTime() + hours * 3600 * 1000);
}

async function runFmPpmGeneration() {
  const startedAt = Date.now();
  let schedulesProcessed = 0;
  let jobsCreated = 0;
  let jobsSkipped = 0;

  try {
    const today = new Date().toISOString().split("T")[0];
    const windowEnd = addDays(today, LOOKAHEAD_DAYS);

    const { rows: schedules } = await pool.query(
      `SELECT id, tenant_id, site_id, name, description, service_line, frequency,
              interval_days, default_start_time, default_end_time, estimated_hours,
              next_due_date, default_supplier_id
         FROM fm_ppm_schedules
        WHERE is_active = true
          AND next_due_date IS NOT NULL
          AND next_due_date <= $1::date`,
      [windowEnd]
    );

    for (const sched of schedules) {
      schedulesProcessed++;
      let currentDue: string = typeof sched.next_due_date === "string"
        ? sched.next_due_date
        : new Date(sched.next_due_date).toISOString().split("T")[0];

      let safetyGuard = 0;
      while (currentDue <= windowEnd && safetyGuard < 60) {
        safetyGuard++;

        const dup = await pool.query(
          `SELECT id FROM fm_jobs
            WHERE tenant_id = $1 AND ppm_schedule_id = $2 AND scheduled_date = $3::date
            LIMIT 1`,
          [sched.tenant_id, sched.id, currentDue]
        );

        if (dup.rows.length === 0) {
          const slaDueAt = computeSlaDueAt(currentDue, sched.default_start_time);
          const inserted = await pool.query(
            `INSERT INTO fm_jobs
               (tenant_id, site_id, title, description, job_type, service_line,
                priority, status, scheduled_date, scheduled_start_time, scheduled_end_time,
                sla_due_at, estimated_hours, supplier_id, ppm_schedule_id, created_by)
             VALUES ($1,$2,$3,$4,'ppm',$5,'medium','raised',$6,$7,$8,$9,$10,$11,$12,NULL)
             RETURNING id`,
            [
              sched.tenant_id,
              sched.site_id,
              sched.name,
              sched.description,
              sched.service_line,
              currentDue,
              sched.default_start_time,
              sched.default_end_time,
              slaDueAt,
              sched.estimated_hours,
              sched.default_supplier_id,
              sched.id,
            ]
          );
          const jobId = inserted.rows[0].id;
          await pool.query(
            `UPDATE fm_jobs SET job_number = $1 WHERE id = $2`,
            [`FM-${String(jobId).padStart(5, "0")}`, jobId]
          );
          jobsCreated++;
        } else {
          jobsSkipped++;
        }

        const nextDue = rollForward(currentDue, sched.frequency, sched.interval_days);
        await pool.query(
          `UPDATE fm_ppm_schedules
              SET last_generated_date = $1::date,
                  next_due_date = $2::date,
                  updated_at = NOW()
            WHERE id = $3`,
          [currentDue, nextDue, sched.id]
        );

        if (nextDue <= currentDue) break;
        currentDue = nextDue;
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[fm-ppm-scheduler] Run complete in ${elapsedMs}ms — schedules=${schedulesProcessed} created=${jobsCreated} skipped=${jobsSkipped}`
    );
  } catch (err) {
    console.error("[fm-ppm-scheduler] Error during PPM job generation:", err);
  }
}

export function startFmPpmScheduler() {
  console.log("[fm-ppm-scheduler] Starting daily FM PPM job generation scheduler");
  runFmPpmGeneration();
  setInterval(() => {
    runFmPpmGeneration();
  }, INTERVAL_MS);
}

export const __testing = { rollForward, addDays, addMonths, runFmPpmGeneration };
