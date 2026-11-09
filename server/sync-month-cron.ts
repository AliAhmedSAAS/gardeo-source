/**
 * Hourly current-month sync for tenants with Custom Payroll enabled.
 * - MAIN / in-house configs → sync without supplier filter (supplier_id null)
 * - Contractor configs → only suppliers with external_id set; skip the rest
 * Runs inside the Gardeo web process (same pattern as qu-emails-cron).
 */
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";
import { storage } from "./storage";
import { runSync } from "./sync-service";
import { ensureCronJobRunsTable } from "./qu-emails-cron";

export const SYNC_MONTH_JOB_NAME = "sync_current_month";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HISTORY_RETENTION_DAYS = 30;
const PREVIEW_MAX = 4000;

type RequireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;

let running = false;
let started = false;

function cronEnabled(): boolean {
  const raw = process.env.SYNC_MONTH_CRON_ENABLED;
  if (raw === undefined || raw === "") {
    return process.env.NODE_ENV === "production";
  }
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
}

function intervalMs(): number {
  const n = Number(process.env.SYNC_MONTH_CRON_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  // Floor at 5 minutes to avoid hammering external APIs
  return Number.isFinite(n) && n >= 5 * 60 * 1000 ? Math.floor(n) : DEFAULT_INTERVAL_MS;
}

/** Current calendar month in Europe/London as YYYY-MM-DD bounds. */
export function currentMonthRangeLondon(now = new Date()): { dateFrom: string; dateTo: string; month: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  const dateFrom = `${y}-${m}-01`;
  const dateTo = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo, month: `${y}-${m}` };
}

function isMainSupplier(s: { companyName?: string | null; externalId?: string | null }): boolean {
  const name = String(s.companyName || "").trim().toLowerCase();
  const ext = String(s.externalId || "")
    .trim()
    .replace(/^sup-/i, "")
    .toLowerCase();
  return (
    name === "main"
    || name === "in house"
    || name === "in-house"
    || name === "inhouse"
    || ext === "1120"
  );
}

function isInhouseConfig(connectionType?: string | null): boolean {
  return connectionType === "rest_php_inhouse";
}

function isContractorShiftsConfig(connectionType?: string | null): boolean {
  return connectionType === "rest_php" || connectionType === "php";
}

function syncLogError(log: { errors?: unknown; status?: string }): string {
  const errs = log.errors;
  if (Array.isArray(errs) && errs.length) return String(errs[0]);
  if (typeof errs === "string" && errs) return errs;
  return "failed";
}

type SyncStepResult = {
  tenantId: number;
  configId: number;
  connectionType: string;
  supplierExternalId: string | null;
  supplierName?: string;
  ok: boolean;
  syncLogId?: number;
  status?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
};

async function pruneOldRuns(): Promise<void> {
  await pool.query(
    `DELETE FROM cron_job_runs
     WHERE job_name = $1
       AND started_at < NOW() - ($2::int * INTERVAL '1 day')`,
    [SYNC_MONTH_JOB_NAME, HISTORY_RETENTION_DAYS],
  );
}

export async function runSyncCurrentMonth(opts?: { triggeredBy?: string }): Promise<{
  id: number;
  ok: boolean;
  durationMs: number;
  error: string | null;
  meta: Record<string, unknown>;
}> {
  await ensureCronJobRunsTable();
  const { dateFrom, dateTo, month } = currentMonthRangeLondon();
  const startedAt = Date.now();
  const insert = await pool.query(
    `INSERT INTO cron_job_runs (job_name, started_at, meta)
     VALUES ($1, NOW(), $2::jsonb)
     RETURNING id`,
    [
      SYNC_MONTH_JOB_NAME,
      JSON.stringify({
        triggeredBy: opts?.triggeredBy || "scheduler",
        dateFrom,
        dateTo,
        month,
      }),
    ],
  );
  const runId = Number(insert.rows[0].id);

  const steps: SyncStepResult[] = [];
  let fatalError: string | null = null;

  try {
    const tenants = await pool.query(
      `SELECT id, name FROM tenants
       WHERE COALESCE(custom_payroll_control_enabled, false) = true
       ORDER BY id`,
    );

    for (const tenant of tenants.rows) {
      const tenantId = Number(tenant.id);
      const configs = await storage.getSyncConfigurations(tenantId);
      const active = configs.filter((c) => c.isActive !== false);

      const inhouseConfigs = active.filter((c) => isInhouseConfig(c.connectionType));
      const contractorConfigs = active.filter((c) => isContractorShiftsConfig(c.connectionType));

      for (const config of inhouseConfigs) {
        try {
          const log = await runSync(config.id, tenantId, undefined, dateFrom, dateTo);
          steps.push({
            tenantId,
            configId: config.id,
            connectionType: String(config.connectionType),
            supplierExternalId: null,
            ok: log.status !== "failed",
            syncLogId: log.id,
            status: log.status,
            error: log.status === "failed" ? syncLogError(log) : undefined,
          });
        } catch (e: any) {
          steps.push({
            tenantId,
            configId: config.id,
            connectionType: String(config.connectionType),
            supplierExternalId: null,
            ok: false,
            error: String(e?.message || e),
          });
        }
      }

      if (contractorConfigs.length === 0) continue;

      const suppliers = await storage.getSuppliersByTenant(tenantId);
      for (const config of contractorConfigs) {
        for (const supplier of suppliers) {
          const externalId = String(supplier.externalId || "").trim();
          if (!externalId) {
            steps.push({
              tenantId,
              configId: config.id,
              connectionType: String(config.connectionType),
              supplierExternalId: null,
              supplierName: supplier.companyName,
              ok: true,
              skipped: true,
              skipReason: "no supplier external_id",
            });
            continue;
          }
          if (isMainSupplier(supplier)) {
            steps.push({
              tenantId,
              configId: config.id,
              connectionType: String(config.connectionType),
              supplierExternalId: externalId,
              supplierName: supplier.companyName,
              ok: true,
              skipped: true,
              skipReason: "MAIN handled by in-house config",
            });
            continue;
          }

          try {
            const log = await runSync(config.id, tenantId, undefined, dateFrom, dateTo, externalId);
            steps.push({
              tenantId,
              configId: config.id,
              connectionType: String(config.connectionType),
              supplierExternalId: externalId,
              supplierName: supplier.companyName,
              ok: log.status !== "failed",
              syncLogId: log.id,
              status: log.status,
              error: log.status === "failed" ? syncLogError(log) : undefined,
            });
          } catch (e: any) {
            steps.push({
              tenantId,
              configId: config.id,
              connectionType: String(config.connectionType),
              supplierExternalId: externalId,
              supplierName: supplier.companyName,
              ok: false,
              error: String(e?.message || e),
            });
          }
        }
      }
    }
  } catch (e: any) {
    fatalError = String(e?.message || e);
  }

  const executed = steps.filter((s) => !s.skipped);
  const failed = executed.filter((s) => !s.ok);
  const skipped = steps.filter((s) => s.skipped);
  const ok = !fatalError && failed.length === 0;
  const durationMs = Date.now() - startedAt;

  const summary = {
    month,
    dateFrom,
    dateTo,
    tenants: [...new Set(steps.map((s) => s.tenantId))].length,
    executed: executed.length,
    failed: failed.length,
    skipped: skipped.length,
    steps: steps.slice(0, 200),
  };

  const preview = JSON.stringify(summary).slice(0, PREVIEW_MAX);
  await pool.query(
    `UPDATE cron_job_runs
     SET finished_at = NOW(),
         ok = $2,
         duration_ms = $3,
         response_preview = $4,
         error = $5,
         meta = COALESCE(meta, '{}'::jsonb) || $6::jsonb
     WHERE id = $1`,
    [
      runId,
      ok,
      durationMs,
      preview,
      fatalError || (failed.length ? `${failed.length} sync step(s) failed` : null),
      JSON.stringify(summary),
    ],
  );

  if (Math.random() < 0.1) {
    try {
      await pruneOldRuns();
    } catch (pruneErr: any) {
      console.warn("[sync-month-cron] prune failed:", pruneErr?.message || pruneErr);
    }
  }

  return {
    id: runId,
    ok,
    durationMs,
    error: fatalError || (failed.length ? `${failed.length} sync step(s) failed` : null),
    meta: summary,
  };
}

async function tick(): Promise<void> {
  if (running) {
    console.warn("[sync-month-cron] Previous run still in progress — skipping tick");
    return;
  }
  running = true;
  try {
    const result = await runSyncCurrentMonth({ triggeredBy: "scheduler" });
    if (result.ok) {
      console.log(
        `[sync-month-cron] OK durationMs=${result.durationMs} runId=${result.id} executed=${(result.meta as any).executed}`,
      );
    } else {
      console.warn(
        `[sync-month-cron] FAIL durationMs=${result.durationMs} error=${result.error} runId=${result.id}`,
      );
    }
  } catch (e: any) {
    console.error("[sync-month-cron] Unexpected error:", e?.message || e);
  } finally {
    running = false;
  }
}

export function startSyncMonthCron(): void {
  if (started) return;
  if (!cronEnabled()) {
    console.log("[sync-month-cron] Disabled (set SYNC_MONTH_CRON_ENABLED=true to enable)");
    return;
  }
  started = true;
  const ms = intervalMs();
  console.log(`[sync-month-cron] Starting every ${ms}ms (current month, custom-payroll tenants)`);

  // Delay first run so boot / other syncs settle
  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, ms);
  }, 30_000);
}

export function registerSyncMonthCronRoutes(app: Express, requireRole: RequireRole): void {
  app.get(
    "/api/admin/cron-jobs/sync-month/runs",
    requireRole("super_admin", "tenant_admin", "ceo", "admin"),
    async (req, res) => {
      try {
        const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
        const { rows } = await pool.query(
          `SELECT id, job_name, started_at, finished_at, ok, http_status, duration_ms,
                  response_preview, error, meta
           FROM cron_job_runs
           WHERE job_name = $1
           ORDER BY started_at DESC
           LIMIT $2`,
          [SYNC_MONTH_JOB_NAME, limit],
        );
        const range = currentMonthRangeLondon();
        res.json({
          enabled: cronEnabled(),
          intervalMs: intervalMs(),
          retentionDays: HISTORY_RETENTION_DAYS,
          currentMonth: range,
          runs: rows,
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/cron-jobs/sync-month/run",
    requireRole("super_admin", "tenant_admin", "ceo", "admin"),
    async (req, res) => {
      try {
        if (running) {
          return res.status(409).json({ message: "A sync-month run is already in progress" });
        }
        running = true;
        try {
          const user = (req as any).user;
          const result = await runSyncCurrentMonth({
            triggeredBy: user?.id ? `manual:${user.id}` : "manual",
          });
          res.json(result);
        } finally {
          running = false;
        }
      } catch (err: any) {
        running = false;
        res.status(500).json({ message: err.message });
      }
    },
  );
}
