import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Authorization / tenant-isolation coverage for the FM operative portal.
 *
 * Routes under test (server/routes.ts: getFmWorkerForUser, requireFmAddon,
 * /api/fm/me, /api/fm/my-jobs*):
 *   - A worker's GET /api/fm/my-jobs only returns jobs assigned to that worker.
 *   - PATCHing another worker's job returns 404 ("Job not assigned to you").
 *   - When the fm_services add-on is inactive, /api/fm/me and /api/fm/my-jobs
 *     return 403, regardless of worker linkage.
 *
 * Two isolated tenants are seeded:
 *   - Tenant A (fm_services ACTIVE): two workers (Alice, Bob) each with their
 *     own job/assignment.
 *   - Tenant B (fm_services INACTIVE): one worker (Carol) with a job.
 * Everything is torn down in afterAll so the dev database is left clean.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || "5000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const PASSWORD = "FmIsolationTest123!";

let pool: Pool;

const seeded: {
  // Tenant A — add-on active, two workers.
  tenantAId?: number;
  aliceUsername?: string;
  aliceWorkerId?: number;
  aliceJobId?: number;
  bobUsername?: string;
  bobWorkerId?: number;
  bobJobId?: number;
  siteAId?: number;
  // Tenant B — add-on inactive.
  tenantBId?: number;
  carolUsername?: string;
  carolWorkerId?: number;
  carolJobId?: number;
  siteBId?: number;
} = {};

async function seedWorker(
  tenantId: number,
  suffix: string,
  first: string,
): Promise<{ username: string; userId: string; workerId: number }> {
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const username = `${first.toLowerCase()}_${suffix}`;
  const email = `${username}@e2e.test`;
  const user = await pool.query(
    `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, 'Operative', 'employee', true) RETURNING id`,
    [tenantId, username, email, hashed, first],
  );
  const userId = user.rows[0].id;
  const worker = await pool.query(
    `INSERT INTO fm_workers (tenant_id, user_id, first_name, last_name, email, trade, service_line, is_active)
     VALUES ($1, $2, $3, 'Operative', $4, 'electrician', 'maintenance', true) RETURNING id`,
    [tenantId, userId, first, email],
  );
  return { username, userId, workerId: worker.rows[0].id };
}

async function seedJob(
  tenantId: number,
  siteId: number,
  suffix: string,
  workerId: number,
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const job = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, 'e2e isolation job', 'reactive', 'maintenance', 'high', 'assigned', $5) RETURNING id`,
    [tenantId, siteId, `ISO-${suffix}`, `Job ${suffix}`, today],
  );
  const jobId = job.rows[0].id;
  await pool.query(
    `INSERT INTO fm_job_assignments (tenant_id, job_id, worker_id, role, status)
     VALUES ($1, $2, $3, 'worker', 'assigned')`,
    [tenantId, jobId, workerId],
  );
  return jobId;
}

async function loginContext(username: string): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", {
    data: { username, password: PASSWORD },
  });
  expect(res.ok(), `login for ${username} should succeed`).toBeTruthy();
  return ctx;
}

test.beforeAll(async () => {
  test.skip(!DATABASE_URL, "DATABASE_URL not set");
  pool = new Pool({ connectionString: DATABASE_URL });

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // --- Tenant A: fm_services ACTIVE, two workers ---
  const tenantA = await pool.query(
    `INSERT INTO tenants (name, slug, industry, is_active)
     VALUES ($1, $2, 'cleaning', true) RETURNING id`,
    [`E2E FM Iso A ${suffix}`, `e2e-fm-iso-a-${suffix}`],
  );
  seeded.tenantAId = tenantA.rows[0].id;
  await pool.query(
    `INSERT INTO tenant_addons (tenant_id, addon_key, addon_name, status)
     VALUES ($1, 'fm_services', 'FM Services', 'active')`,
    [seeded.tenantAId],
  );

  const siteA = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, is_active)
     VALUES ($1, $2, '1 Test Street', 'London', 'EC1A 1AA', true) RETURNING id`,
    [seeded.tenantAId, `E2E FM Iso Site A ${suffix}`],
  );
  seeded.siteAId = siteA.rows[0].id;

  const alice = await seedWorker(seeded.tenantAId!, suffix, "Alice");
  seeded.aliceUsername = alice.username;
  seeded.aliceWorkerId = alice.workerId;
  seeded.aliceJobId = await seedJob(seeded.tenantAId!, seeded.siteAId!, `A-${suffix}`, alice.workerId);

  const bob = await seedWorker(seeded.tenantAId!, suffix, "Bob");
  seeded.bobUsername = bob.username;
  seeded.bobWorkerId = bob.workerId;
  seeded.bobJobId = await seedJob(seeded.tenantAId!, seeded.siteAId!, `B-${suffix}`, bob.workerId);

  // --- Tenant B: fm_services INACTIVE ---
  const tenantB = await pool.query(
    `INSERT INTO tenants (name, slug, industry, is_active)
     VALUES ($1, $2, 'cleaning', true) RETURNING id`,
    [`E2E FM Iso B ${suffix}`, `e2e-fm-iso-b-${suffix}`],
  );
  seeded.tenantBId = tenantB.rows[0].id;
  // Intentionally NO tenant_addons row for fm_services.

  const siteB = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, is_active)
     VALUES ($1, $2, '2 Test Street', 'London', 'EC1A 1BB', true) RETURNING id`,
    [seeded.tenantBId, `E2E FM Iso Site B ${suffix}`],
  );
  seeded.siteBId = siteB.rows[0].id;

  const carol = await seedWorker(seeded.tenantBId!, suffix, "Carol");
  seeded.carolUsername = carol.username;
  seeded.carolWorkerId = carol.workerId;
  seeded.carolJobId = await seedJob(seeded.tenantBId!, seeded.siteBId!, `C-${suffix}`, carol.workerId);
});

test.afterAll(async () => {
  if (!pool) return;
  for (const t of [seeded.tenantAId, seeded.tenantBId]) {
    if (!t) continue;
    await pool.query("DELETE FROM fm_job_assignments WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_jobs WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_workers WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM sites WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM audit_logs WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM tenant_addons WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM tenants WHERE id = $1", [t]).catch(() => {});
  }
  await pool.end();
});

test("a worker only sees their own jobs and cannot update another worker's job", async () => {
  const aliceCtx = await loginContext(seeded.aliceUsername!);
  const bobCtx = await loginContext(seeded.bobUsername!);

  try {
    // Alice's /api/fm/my-jobs returns only Alice's job.
    const aliceJobsRes = await aliceCtx.get("/api/fm/my-jobs");
    expect(aliceJobsRes.ok()).toBeTruthy();
    const aliceJobs = await aliceJobsRes.json();
    expect(Array.isArray(aliceJobs)).toBe(true);
    expect(aliceJobs.map((j: any) => j.id)).toEqual([seeded.aliceJobId]);

    // Bob's /api/fm/my-jobs returns only Bob's job.
    const bobJobsRes = await bobCtx.get("/api/fm/my-jobs");
    expect(bobJobsRes.ok()).toBeTruthy();
    const bobJobs = await bobJobsRes.json();
    expect(Array.isArray(bobJobs)).toBe(true);
    expect(bobJobs.map((j: any) => j.id)).toEqual([seeded.bobJobId]);

    // Alice cannot fetch Bob's job by id.
    const aliceGetBob = await aliceCtx.get(`/api/fm/my-jobs/${seeded.bobJobId}`);
    expect(aliceGetBob.status()).toBe(404);

    // Alice cannot PATCH (update/complete) Bob's job — returns 404.
    const alicePatchBob = await aliceCtx.patch(`/api/fm/my-jobs/${seeded.bobJobId}`, {
      data: { status: "in_progress", lat: 51.5, lng: -0.1 },
    });
    expect(alicePatchBob.status()).toBe(404);

    // Bob likewise cannot PATCH Alice's job.
    const bobPatchAlice = await bobCtx.patch(`/api/fm/my-jobs/${seeded.aliceJobId}`, {
      data: { status: "in_progress", lat: 51.5, lng: -0.1 },
    });
    expect(bobPatchAlice.status()).toBe(404);

    // Sanity: Bob's job is untouched (still 'assigned').
    const { rows } = await pool.query("SELECT status FROM fm_jobs WHERE id = $1", [seeded.bobJobId]);
    expect(rows[0].status).toBe("assigned");
  } finally {
    await aliceCtx.dispose();
    await bobCtx.dispose();
  }
});

test("FM portal endpoints return 403 when the fm_services add-on is inactive", async () => {
  const carolCtx = await loginContext(seeded.carolUsername!);

  try {
    const meRes = await carolCtx.get("/api/fm/me");
    expect(meRes.status()).toBe(403);

    const jobsRes = await carolCtx.get("/api/fm/my-jobs");
    expect(jobsRes.status()).toBe(403);
  } finally {
    await carolCtx.dispose();
  }
});
