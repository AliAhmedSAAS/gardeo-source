import { pool } from "./db";

async function runProbationReminderCheck() {
  try {
    const in28Days = new Date();
    in28Days.setDate(in28Days.getDate() + 28);
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const in28DaysStr = in28Days.toISOString().split("T")[0];
    const in7DaysStr = in7Days.toISOString().split("T")[0];

    const thresholds = [
      { date: in28DaysStr, daysBefore: 28, label: "28 days" },
      { date: in7DaysStr, daysBefore: 7, label: "7 days" },
    ];

    for (const threshold of thresholds) {
      const { rows: records } = await pool.query(
        `SELECT pr.id, pr.tenant_id, pr.employee_id, pr.review_date, pr.extended_review_date,
                u.first_name || ' ' || u.last_name AS employee_name,
                e.user_id AS employee_user_id
         FROM probation_records pr
         JOIN employees e ON pr.employee_id = e.id
         JOIN users u ON e.user_id = u.id
         WHERE pr.status IN ('active', 'extended')
           AND COALESCE(pr.extended_review_date, pr.review_date) = $1`,
        [threshold.date]
      );

      for (const record of records) {
        const dedup = await pool.query(
          `SELECT id FROM notifications
           WHERE type = 'probation_review_reminder'
             AND metadata->>'probationId' = $1
             AND metadata->>'daysBefore' = $2
             AND created_at > NOW() - INTERVAL '6 days'`,
          [String(record.id), String(threshold.daysBefore)]
        );
        if (dedup.rows.length > 0) continue;

        const effectiveDate = record.extended_review_date || record.review_date;
        const body = `Probation review for ${record.employee_name} is due in ${threshold.label} (${effectiveDate}). Please schedule the review meeting.`;

        const { rows: managers } = await pool.query(
          `SELECT id FROM users
           WHERE tenant_id = $1
             AND role IN ('super_admin', 'tenant_admin', 'ceo', 'operations_manager', 'admin', 'hr_manager')
             AND is_active = true
           LIMIT 10`,
          [record.tenant_id]
        );

        for (const manager of managers) {
          await pool.query(
            `INSERT INTO notifications
               (user_id, type, title, body, link, related_entity_type, related_entity_id, metadata, created_at)
             VALUES ($1, 'probation_review_reminder', 'Probation Review Due Soon', $2, '/probation', 'probation_record', $3, $4, NOW())`,
            [
              manager.id,
              body,
              String(record.id),
              JSON.stringify({
                probationId: record.id,
                employeeId: record.employee_id,
                employeeName: record.employee_name,
                reviewDate: effectiveDate,
                daysBefore: threshold.daysBefore,
              }),
            ]
          );
        }
      }
    }
  } catch (err) {
    console.error("[probation-scheduler] Error during reminder check:", err);
  }
}

export function startProbationScheduler() {
  console.log("[probation-scheduler] Starting daily probation review reminder scheduler");
  runProbationReminderCheck();
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runProbationReminderCheck();
  }, INTERVAL_MS);
}
