/**
 * Every-minute ping of Teamgate QU email flush endpoint + run history in DB.
 * URL: https://gfmtrack.co.uk/Teamgate/SMS/db_SendQUEmails_1.php
 */
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";

export const QU_EMAILS_JOB_NAME = "gfmtrack_qu_emails";

const DEFAULT_URL = "https://gfmtrack.co.uk/Teamgate/SMS/db_SendQUEmails_1.php";
const DEFAULT_INTERVAL_MS = 60_000;
const RESPONSE_PREVIEW_MAX = 2000;
const HISTORY_RETENTION_DAYS = 14;

type RequireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;

let running = false;
let started = false;

function cronEnabled(): boolean {
  const raw = process.env.QU_EMAILS_CRON_ENABLED;
  if (raw === undefined || raw === "") {
    // Production on by default; local/dev off unless explicitly enabled.
    return process.env.NODE_ENV === "production";
  }
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
}

function cronUrl(): string {
  return (process.env.QU_EMAILS_CRON_URL || DEFAULT_URL).trim();
}

function intervalMs(): number {
  const n = Number(process.env.QU_EMAILS_CRON_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  return Number.isFinite(n) && n >= 15_000 ? Math.floor(n) : DEFAULT_INTERVAL_MS;
}

export async function ensureCronJobRunsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cron_job_runs (
      id serial PRIMARY KEY,
      job_name text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT NOW(),
      finished_at timestamptz,
      ok boolean,
      http_status integer,
      duration_ms integer,
      response_preview text,
      error text,
      meta jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_started
      ON cron_job_runs (job_name, started_at DESC);
  `);
}

async function pruneOldRuns(): Promise<void> {
  await pool.query(
    `DELETE FROM cron_job_runs
     WHERE job_name = $1
       AND started_at < NOW() - ($2::int * INTERVAL '1 day')`,
    [QU_EMAILS_JOB_NAME, HISTORY_RETENTION_DAYS],
  );
}

export async function runQuEmailsPing(opts?: { triggeredBy?: string }): Promise<{
  id: number;
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  error: string | null;
}> {
  const url = cronUrl();
  const startedAt = Date.now();
  const insert = await pool.query(
    `INSERT INTO cron_job_runs (job_name, started_at, meta)
     VALUES ($1, NOW(), $2::jsonb)
     RETURNING id`,
    [
      QU_EMAILS_JOB_NAME,
      JSON.stringify({
        url,
        triggeredBy: opts?.triggeredBy || "scheduler",
      }),
    ],
  );
  const runId = Number(insert.rows[0].id);

  let ok = false;
  let httpStatus: number | null = null;
  let preview: string | null = null;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/json,*/*",
          "User-Agent": "Gardeo-QU-Emails-Cron/1.0",
        },
      });
      httpStatus = res.status;
      const text = await res.text();
      preview = text.slice(0, RESPONSE_PREVIEW_MAX);
      ok = res.ok;
      if (!ok) error = `HTTP ${res.status}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: any) {
    error = e?.name === "AbortError" ? "Request timed out (55s)" : String(e?.message || e);
    ok = false;
  }

  const durationMs = Date.now() - startedAt;
  await pool.query(
    `UPDATE cron_job_runs
     SET finished_at = NOW(),
         ok = $2,
         http_status = $3,
         duration_ms = $4,
         response_preview = $5,
         error = $6
     WHERE id = $1`,
    [runId, ok, httpStatus, durationMs, preview, error],
  );

  if (Math.random() < 0.05) {
    try {
      await pruneOldRuns();
    } catch (pruneErr: any) {
      console.warn("[qu-emails-cron] prune failed:", pruneErr?.message || pruneErr);
    }
  }

  return { id: runId, ok, httpStatus, durationMs, error };
}

async function tick(): Promise<void> {
  if (running) {
    console.warn("[qu-emails-cron] Previous run still in progress — skipping tick");
    return;
  }
  running = true;
  try {
    const result = await runQuEmailsPing({ triggeredBy: "scheduler" });
    if (result.ok) {
      console.log(
        `[qu-emails-cron] OK status=${result.httpStatus} durationMs=${result.durationMs} runId=${result.id}`,
      );
    } else {
      console.warn(
        `[qu-emails-cron] FAIL status=${result.httpStatus} durationMs=${result.durationMs} error=${result.error} runId=${result.id}`,
      );
    }
  } catch (e: any) {
    console.error("[qu-emails-cron] Unexpected error:", e?.message || e);
  } finally {
    running = false;
  }
}

export function startQuEmailsCron(): void {
  if (started) return;
  if (!cronEnabled()) {
    console.log("[qu-emails-cron] Disabled (set QU_EMAILS_CRON_ENABLED=true to enable)");
    return;
  }
  started = true;
  const ms = intervalMs();
  console.log(`[qu-emails-cron] Starting every ${ms}ms → ${cronUrl()}`);

  // Slight delay so boot isn't blocked; then every minute.
  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, ms);
  }, 5_000);
}

export function registerQuEmailsCronRoutes(app: Express, requireRole: RequireRole): void {
  app.get(
    "/api/admin/cron-jobs/qu-emails/runs",
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
          [QU_EMAILS_JOB_NAME, limit],
        );
        res.json({
          enabled: cronEnabled(),
          url: cronUrl(),
          intervalMs: intervalMs(),
          retentionDays: HISTORY_RETENTION_DAYS,
          runs: rows,
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/cron-jobs/qu-emails/run",
    requireRole("super_admin", "tenant_admin", "ceo", "admin"),
    async (req, res) => {
      try {
        if (running) {
          return res.status(409).json({ message: "A run is already in progress" });
        }
        running = true;
        try {
          const user = (req as any).user;
          const result = await runQuEmailsPing({
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
