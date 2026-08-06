import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Cross-tenant WRITE/READ protection for the FM *admin* endpoints
 * (server/routes.ts: assertTenantOwns + tenant predicates):
 *   - /api/fm/workers, /api/fm/suppliers, /api/fm/jobs, /api/fm/ppm (GET)
 *   - /api/fm/jobs (POST), /api/fm/jobs/:id (GET/PATCH)
 *   - /api/fm/jobs/:id/assign (POST), /api/fm/ppm (POST)
 *
 * An admin in tenant A must never be able to:
 *   - see tenant B's workers/suppliers/jobs/ppm in GET listings,
 *   - create/update a job or ppm referencing tenant B's siteId/supplierId/workerId,
 *   - mutate tenant B's job by id, or
 *   - assign a tenant-B worker to a tenant-A job (or assign to a tenant-B job).
 *
 * Two FM-enabled tenants are seeded; everything is torn down in afterAll so
 * the dev database is left clean.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || "5000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const PASSWORD = "FmAdminIsolationTest123!";

let pool: Pool;

const seeded: {
  // Tenant A — add-on active, admin user + own FM records.
  tenantAId?: number;
  adminUsername?: string;
  siteAId?: number;
  workerAId?: number;
  supplierAId?: number;
  jobAId?: number;
  ppmAId?: number;
  // Tenant B — add-on active, separate FM records the admin must not touch.
  tenantBId?: number;
  siteBId?: number;
  workerBId?: number;
  supplierBId?: number;
  jobBId?: number;
  ppmBId?: number;
} = {};

async function activateFm(tenantId: number) {
  await pool.query(
    `INSERT INTO tenant_addons (tenant_id, addon_key, addon_name, status)
     VALUES ($1, 'fm_services', 'FM Services', 'active')`,
    [tenantId],
  );
}

async function seedTenant(suffix: string, letter: string): Promise<number> {
  const tenant = await pool.query(
    `INSERT INTO tenants (name, slug, industry, is_active)
     VALUES ($1, $2, 'cleaning', true) RETURNING id`,
    [`E2E FM Admin ${letter} ${suffix}`, `e2e-fm-admin-${letter.toLowerCase()}-${suffix}`],
  );
  const tenantId = tenant.rows[0].id;
  await activateFm(tenantId);
  return tenantId;
}

async function seedSite(tenantId: number, suffix: string, letter: string): Promise<number> {
  const site = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, is_active)
     VALUES ($1, $2, '1 Test Street', 'London', 'EC1A 1AA', true) RETURNING id`,
    [tenantId, `E2E FM Admin Site ${letter} ${suffix}`],
  );
  return site.rows[0].id;
}

async function seedWorker(tenantId: number, first: string): Promise<number> {
  const email = `${first.toLowerCase()}@e2e.test`;
  const worker = await pool.query(
    `INSERT INTO fm_workers (tenant_id, first_name, last_name, email, trade, service_line, is_active)
     VALUES ($1, $2, 'Worker', $3, 'electrician', 'maintenance', true) RETURNING id`,
    [tenantId, first, email],
  );
  return worker.rows[0].id;
}

async function seedSupplier(tenantId: number, name: string): Promise<number> {
  const supplier = await pool.query(
    `INSERT INTO fm_suppliers (tenant_id, company_name, is_active)
     VALUES ($1, $2, true) RETURNING id`,
    [tenantId, name],
  );
  return supplier.rows[0].id;
}

async function seedJob(tenantId: number, siteId: number, suffix: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const job = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, 'e2e admin isolation job', 'reactive', 'maintenance', 'high', 'raised', $5) RETURNING id`,
    [tenantId, siteId, `ADM-${suffix}`, `Job ${suffix}`, today],
  );
  return job.rows[0].id;
}

async function seedPpm(tenantId: number, siteId: number, name: string): Promise<number> {
  const ppm = await pool.query(
    `INSERT INTO fm_ppm_schedules (tenant_id, site_id, name, service_line, frequency, is_active)
     VALUES ($1, $2, $3, 'maintenance', 'monthly', true) RETURNING id`,
    [tenantId, siteId, name],
  );
  return ppm.rows[0].id;
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

  // --- Tenant A: admin + FM records ---
  seeded.tenantAId = await seedTenant(suffix, "A");
  seeded.adminUsername = `fmadmin_${suffix}`;
  const hashed = await bcrypt.hash(PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'FM', 'Admin', 'tenant_admin', true)`,
    [seeded.tenantAId, seeded.adminUsername, `${seeded.adminUsername}@e2e.test`, hashed],
  );
  seeded.siteAId = await seedSite(seeded.tenantAId!, suffix, "A");
  seeded.workerAId = await seedWorker(seeded.tenantAId!, `AliceA${suffix}`);
  seeded.supplierAId = await seedSupplier(seeded.tenantAId!, `Supplier A ${suffix}`);
  seeded.jobAId = await seedJob(seeded.tenantAId!, seeded.siteAId!, `A-${suffix}`);
  seeded.ppmAId = await seedPpm(seeded.tenantAId!, seeded.siteAId!, `PPM A ${suffix}`);

  // --- Tenant B: separate FM records (admin of A must not touch) ---
  seeded.tenantBId = await seedTenant(suffix, "B");
  seeded.siteBId = await seedSite(seeded.tenantBId!, suffix, "B");
  seeded.workerBId = await seedWorker(seeded.tenantBId!, `CarolB${suffix}`);
  seeded.supplierBId = await seedSupplier(seeded.tenantBId!, `Supplier B ${suffix}`);
  seeded.jobBId = await seedJob(seeded.tenantBId!, seeded.siteBId!, `B-${suffix}`);
  seeded.ppmBId = await seedPpm(seeded.tenantBId!, seeded.siteBId!, `PPM B ${suffix}`);
});

test.afterAll(async () => {
  if (!pool) return;
  for (const t of [seeded.tenantAId, seeded.tenantBId]) {
    if (!t) continue;
    await pool.query("DELETE FROM fm_job_assignments WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_jobs WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_ppm_schedules WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_workers WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM fm_suppliers WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM sites WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM audit_logs WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM tenant_addons WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM tenants WHERE id = $1", [t]).catch(() => {});
  }
  await pool.end();
});

test("GET listings never return another tenant's FM records", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    const workersRes = await ctx.get("/api/fm/workers");
    expect(workersRes.ok()).toBeTruthy();
    const workers = await workersRes.json();
    const workerIds = workers.map((w: any) => w.id);
    expect(workerIds).toContain(seeded.workerAId);
    expect(workerIds).not.toContain(seeded.workerBId);

    const suppliersRes = await ctx.get("/api/fm/suppliers");
    expect(suppliersRes.ok()).toBeTruthy();
    const supplierIds = (await suppliersRes.json()).map((s: any) => s.id);
    expect(supplierIds).toContain(seeded.supplierAId);
    expect(supplierIds).not.toContain(seeded.supplierBId);

    const jobsRes = await ctx.get("/api/fm/jobs");
    expect(jobsRes.ok()).toBeTruthy();
    const jobIds = (await jobsRes.json()).map((j: any) => j.id);
    expect(jobIds).toContain(seeded.jobAId);
    expect(jobIds).not.toContain(seeded.jobBId);

    const ppmRes = await ctx.get("/api/fm/ppm");
    expect(ppmRes.ok()).toBeTruthy();
    const ppmIds = (await ppmRes.json()).map((p: any) => p.id);
    expect(ppmIds).toContain(seeded.ppmAId);
    expect(ppmIds).not.toContain(seeded.ppmBId);
  } finally {
    await ctx.dispose();
  }
});

test("cannot fetch or mutate another tenant's job by id", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    // GET tenant B's job by id -> 404.
    const getB = await ctx.get(`/api/fm/jobs/${seeded.jobBId}`);
    expect(getB.status()).toBe(404);

    // PATCH tenant B's job by id -> 404 (assertTenantOwns('fm_jobs') fails).
    const patchB = await ctx.patch(`/api/fm/jobs/${seeded.jobBId}`, {
      data: { status: "in_progress" },
    });
    expect(patchB.status()).toBe(404);

    // Tenant B's job is untouched.
    const { rows } = await pool.query("SELECT status FROM fm_jobs WHERE id = $1", [seeded.jobBId]);
    expect(rows[0].status).toBe("raised");
  } finally {
    await ctx.dispose();
  }
});

test("cannot create a job referencing another tenant's foreign keys", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    // Cross-tenant siteId rejected.
    const badSite = await ctx.post("/api/fm/jobs", {
      data: { title: "X", siteId: seeded.siteBId, serviceLine: "maintenance" },
    });
    expect(badSite.status()).toBe(400);
    expect((await badSite.json()).message).toMatch(/siteId/i);

    // Cross-tenant supplierId rejected.
    const badSupplier = await ctx.post("/api/fm/jobs", {
      data: { title: "X", siteId: seeded.siteAId, supplierId: seeded.supplierBId, serviceLine: "maintenance" },
    });
    expect(badSupplier.status()).toBe(400);
    expect((await badSupplier.json()).message).toMatch(/supplierId/i);

    // Cross-tenant workerId in workerIds[] rejected.
    const badWorker = await ctx.post("/api/fm/jobs", {
      data: { title: "X", siteId: seeded.siteAId, serviceLine: "maintenance", workerIds: [seeded.workerBId] },
    });
    expect(badWorker.status()).toBe(400);
    expect((await badWorker.json()).message).toMatch(/workerId/i);

    // No tenant-B-referencing job leaked into tenant B.
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM fm_jobs WHERE site_id = $1 AND tenant_id = $2",
      [seeded.siteBId, seeded.tenantAId],
    );
    expect(rows[0].n).toBe(0);
  } finally {
    await ctx.dispose();
  }
});

test("cannot patch own job to reference another tenant's foreign keys", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    const badSite = await ctx.patch(`/api/fm/jobs/${seeded.jobAId}`, {
      data: { siteId: seeded.siteBId },
    });
    expect(badSite.status()).toBe(400);
    expect((await badSite.json()).message).toMatch(/siteId/i);

    const badSupplier = await ctx.patch(`/api/fm/jobs/${seeded.jobAId}`, {
      data: { supplierId: seeded.supplierBId },
    });
    expect(badSupplier.status()).toBe(400);
    expect((await badSupplier.json()).message).toMatch(/supplierId/i);

    // Tenant A's job still points at tenant A's site.
    const { rows } = await pool.query("SELECT site_id FROM fm_jobs WHERE id = $1", [seeded.jobAId]);
    expect(rows[0].site_id).toBe(seeded.siteAId);
  } finally {
    await ctx.dispose();
  }
});

test("cannot assign a cross-tenant worker or assign to a cross-tenant job", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    // Assign tenant B's worker to tenant A's job -> 400 Invalid workerId.
    const badWorker = await ctx.post(`/api/fm/jobs/${seeded.jobAId}/assign`, {
      data: { workerId: seeded.workerBId },
    });
    expect(badWorker.status()).toBe(400);
    expect((await badWorker.json()).message).toMatch(/workerId/i);

    // Assign any worker to tenant B's job -> 404 Job not found.
    const badJob = await ctx.post(`/api/fm/jobs/${seeded.jobBId}/assign`, {
      data: { workerId: seeded.workerAId },
    });
    expect(badJob.status()).toBe(404);

    // No assignment leaked onto tenant B's job.
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM fm_job_assignments WHERE job_id = $1",
      [seeded.jobBId],
    );
    expect(rows[0].n).toBe(0);
  } finally {
    await ctx.dispose();
  }
});

test("cannot update another tenant's worker or supplier by id", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    const patchWorker = await ctx.patch(`/api/fm/workers/${seeded.workerBId}`, {
      data: { firstName: "Hacked" },
    });
    expect(patchWorker.status()).toBe(404);

    const patchSupplier = await ctx.patch(`/api/fm/suppliers/${seeded.supplierBId}`, {
      data: { companyName: "Hacked Ltd" },
    });
    expect(patchSupplier.status()).toBe(404);

    // Tenant B's records are untouched.
    const w = await pool.query("SELECT first_name FROM fm_workers WHERE id = $1", [seeded.workerBId]);
    expect(w.rows[0].first_name).not.toBe("Hacked");
    const s = await pool.query("SELECT company_name FROM fm_suppliers WHERE id = $1", [seeded.supplierBId]);
    expect(s.rows[0].company_name).not.toBe("Hacked Ltd");
  } finally {
    await ctx.dispose();
  }
});

test("cannot create a PPM schedule referencing another tenant's foreign keys", async () => {
  const ctx = await loginContext(seeded.adminUsername!);
  try {
    const badSite = await ctx.post("/api/fm/ppm", {
      data: { name: "X", siteId: seeded.siteBId, serviceLine: "maintenance" },
    });
    expect(badSite.status()).toBe(400);
    expect((await badSite.json()).message).toMatch(/siteId/i);

    const badSupplier = await ctx.post("/api/fm/ppm", {
      data: { name: "X", siteId: seeded.siteAId, defaultSupplierId: seeded.supplierBId, serviceLine: "maintenance" },
    });
    expect(badSupplier.status()).toBe(400);
    expect((await badSupplier.json()).message).toMatch(/supplierId/i);

    // No tenant-B-referencing ppm leaked into tenant A.
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM fm_ppm_schedules WHERE site_id = $1 AND tenant_id = $2",
      [seeded.siteBId, seeded.tenantAId],
    );
    expect(rows[0].n).toBe(0);
  } finally {
    await ctx.dispose();
  }
});
