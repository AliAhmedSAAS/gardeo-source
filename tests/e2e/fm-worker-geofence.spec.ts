import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Geolocation (geofence) coverage for the FM operative check-in / check-out flow.
 *
 * Route under test (server/routes.ts: PATCH /api/fm/my-jobs/:id):
 *   When a worker starts a job (status=in_progress / check-in) or completes it
 *   (status=completed / check-out) the route:
 *     - requires lat/lng (400 if missing),
 *     - validates coordinate ranges (400 if out of range),
 *     - computes the Haversine distance from the job's site,
 *     - flags whether the worker is within the tenant's geofence radius,
 *     - persists check-in / check-out lat/lng/distance/within_range columns on
 *       fm_job_assignments,
 *     - writes an fm_worker_checkin / fm_worker_checkout audit_logs row.
 *
 * A single tenant (fm_services ACTIVE, 200m geofence) is seeded with one site
 * that has latitude/longitude, one worker, and one assigned job. Everything is
 * torn down in afterAll so the dev database is left clean.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || "5000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const PASSWORD = "FmGeofenceTest123!";

// Site location (central London) and the geofence radius we seed on the tenant.
const SITE_LAT = 51.5074;
const SITE_LNG = -0.1278;
const GEOFENCE_RADIUS = 200;

let pool: Pool;

const seeded: {
  tenantId?: number;
  siteId?: number;
  username?: string;
  userId?: string;
  workerId?: number;
  jobId?: number;
  assignmentId?: number;
} = {};

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

  const tenant = await pool.query(
    `INSERT INTO tenants (name, slug, industry, is_active, geofence_radius_metres)
     VALUES ($1, $2, 'cleaning', true, $3) RETURNING id`,
    [`E2E FM Geo ${suffix}`, `e2e-fm-geo-${suffix}`, GEOFENCE_RADIUS],
  );
  seeded.tenantId = tenant.rows[0].id;

  await pool.query(
    `INSERT INTO tenant_addons (tenant_id, addon_key, addon_name, status)
     VALUES ($1, 'fm_services', 'FM Services', 'active')`,
    [seeded.tenantId],
  );

  const site = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, latitude, longitude, is_active)
     VALUES ($1, $2, '1 Geo Street', 'London', 'EC1A 1AA', $3, $4, true) RETURNING id`,
    [seeded.tenantId, `E2E FM Geo Site ${suffix}`, String(SITE_LAT), String(SITE_LNG)],
  );
  seeded.siteId = site.rows[0].id;

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const username = `geo_${suffix}`;
  const email = `${username}@e2e.test`;
  const user = await pool.query(
    `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'Geo', 'Operative', 'employee', true) RETURNING id`,
    [seeded.tenantId, username, email, hashed],
  );
  seeded.username = username;
  seeded.userId = user.rows[0].id;

  const worker = await pool.query(
    `INSERT INTO fm_workers (tenant_id, user_id, first_name, last_name, email, trade, service_line, is_active)
     VALUES ($1, $2, 'Geo', 'Operative', $3, 'electrician', 'maintenance', true) RETURNING id`,
    [seeded.tenantId, seeded.userId, email],
  );
  seeded.workerId = worker.rows[0].id;

  const today = new Date().toISOString().split("T")[0];
  const job = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, 'e2e geofence job', 'reactive', 'maintenance', 'high', 'assigned', $5) RETURNING id`,
    [seeded.tenantId, seeded.siteId, `GEO-${suffix}`, `Job GEO-${suffix}`, today],
  );
  seeded.jobId = job.rows[0].id;

  const assignment = await pool.query(
    `INSERT INTO fm_job_assignments (tenant_id, job_id, worker_id, role, status)
     VALUES ($1, $2, $3, 'worker', 'assigned') RETURNING id`,
    [seeded.tenantId, seeded.jobId, seeded.workerId],
  );
  seeded.assignmentId = assignment.rows[0].id;
});

test.afterAll(async () => {
  if (!pool) return;
  const t = seeded.tenantId;
  if (t) {
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

test("check-in/out is rejected without GPS and outside the site geofence, accepted within it", async () => {
  const ctx = await loginContext(seeded.username!);
  const jobUrl = `/api/fm/my-jobs/${seeded.jobId}`;

  try {
    // (a) Check-in without lat/lng is rejected with 400.
    const noLocation = await ctx.patch(jobUrl, { data: { status: "in_progress" } });
    expect(noLocation.status(), "missing GPS should be rejected").toBe(400);

    // (b) Out-of-range coordinates are rejected with 400.
    const outOfRange = await ctx.patch(jobUrl, {
      data: { status: "in_progress", lat: 200, lng: 400 },
    });
    expect(outOfRange.status(), "invalid coordinates should be rejected").toBe(400);

    // Nothing should have been persisted to the assignment yet.
    const beforeRow = await pool.query(
      "SELECT status, check_in_lat, check_in_within_range FROM fm_job_assignments WHERE id = $1",
      [seeded.assignmentId],
    );
    expect(beforeRow.rows[0].status).toBe("assigned");
    expect(beforeRow.rows[0].check_in_lat).toBeNull();

    // (c) Check-in far from the site: accepted (200) but flagged outside the geofence.
    const FAR_LAT = 52.4862; // Birmingham — well over 100km away.
    const FAR_LNG = -1.8904;
    const farCheckIn = await ctx.patch(jobUrl, {
      data: { status: "in_progress", lat: FAR_LAT, lng: FAR_LNG },
    });
    expect(farCheckIn.status(), "far check-in should still succeed").toBe(200);
    const farBody = await farCheckIn.json();
    expect(farBody.withinRange, "far check-in should be flagged outside range").toBe(false);
    expect(typeof farBody.distanceFromSite).toBe("number");
    expect(farBody.distanceFromSite).toBeGreaterThan(GEOFENCE_RADIUS);
    expect(farBody.geofenceRadius).toBe(GEOFENCE_RADIUS);

    // The check-in lat/lng/distance/within_range columns are persisted.
    const afterCheckIn = await pool.query(
      `SELECT status, check_in_lat, check_in_lng, check_in_distance_metres, check_in_within_range
       FROM fm_job_assignments WHERE id = $1`,
      [seeded.assignmentId],
    );
    const ci = afterCheckIn.rows[0];
    expect(ci.status).toBe("in_progress");
    expect(parseFloat(ci.check_in_lat)).toBeCloseTo(FAR_LAT, 4);
    expect(parseFloat(ci.check_in_lng)).toBeCloseTo(FAR_LNG, 4);
    expect(parseFloat(ci.check_in_distance_metres)).toBeGreaterThan(GEOFENCE_RADIUS);
    expect(ci.check_in_within_range).toBe(false);

    // An fm_worker_checkin audit row is written.
    const checkinAudit = await pool.query(
      `SELECT id FROM audit_logs
       WHERE tenant_id = $1 AND action = 'fm_worker_checkin' AND entity_type = 'fm_job' AND entity_id = $2`,
      [seeded.tenantId, String(seeded.jobId)],
    );
    expect(checkinAudit.rows.length).toBeGreaterThanOrEqual(1);

    // (d) Check-out within the geofence radius: withinRange true.
    const nearCheckOut = await ctx.patch(jobUrl, {
      data: { status: "completed", lat: SITE_LAT, lng: SITE_LNG },
    });
    expect(nearCheckOut.status(), "near check-out should succeed").toBe(200);
    const nearBody = await nearCheckOut.json();
    expect(nearBody.withinRange, "near check-out should be within range").toBe(true);
    expect(typeof nearBody.distanceFromSite).toBe("number");
    expect(nearBody.distanceFromSite).toBeLessThanOrEqual(GEOFENCE_RADIUS);

    // The check-out columns are persisted.
    const afterCheckOut = await pool.query(
      `SELECT status, check_out_lat, check_out_lng, check_out_distance_metres, check_out_within_range
       FROM fm_job_assignments WHERE id = $1`,
      [seeded.assignmentId],
    );
    const co = afterCheckOut.rows[0];
    expect(co.status).toBe("completed");
    expect(parseFloat(co.check_out_lat)).toBeCloseTo(SITE_LAT, 4);
    expect(parseFloat(co.check_out_lng)).toBeCloseTo(SITE_LNG, 4);
    expect(parseFloat(co.check_out_distance_metres)).toBeLessThanOrEqual(GEOFENCE_RADIUS);
    expect(co.check_out_within_range).toBe(true);

    // An fm_worker_checkout audit row is written.
    const checkoutAudit = await pool.query(
      `SELECT id FROM audit_logs
       WHERE tenant_id = $1 AND action = 'fm_worker_checkout' AND entity_type = 'fm_job' AND entity_id = $2`,
      [seeded.tenantId, String(seeded.jobId)],
    );
    expect(checkoutAudit.rows.length).toBeGreaterThanOrEqual(1);
  } finally {
    await ctx.dispose();
  }
});
