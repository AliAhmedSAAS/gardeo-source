import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Geolocation (geofence) coverage for the SECURITY OFFICER mobile-portal
 * check-in / check-out flow.
 *
 * Routes under test (server/routes.ts):
 *   POST /api/my-shifts/:id/checkin
 *   POST /api/my-shifts/:id/checkout
 *
 * Both routes share the same Haversine + geofence logic as the FM operative
 * flow. When an officer checks in (scheduled -> in_progress) or checks out
 * (in_progress -> completed) the route:
 *     - requires lat/lng (400 if missing),
 *     - validates coordinate ranges (400 if out of range),
 *     - computes the Haversine distance from the shift's site,
 *     - flags whether the officer is within the tenant's geofence radius,
 *     - persists last_check_in/out_lat/lng + check_in/out_distance_metres on
 *       the shifts row,
 *     - writes an employee_self_checkin / employee_self_checkout audit_logs row
 *       whose details JSON carries the withinRange flag.
 *
 * Check-in additionally requires a passed pre-shift ops check, so one is seeded.
 *
 * A single tenant (200m geofence, wide time window) is seeded with one site that
 * has latitude/longitude, one employee, one scheduled shift dated today, and a
 * passed ops check. Everything is torn down in afterAll so the dev database is
 * left clean.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || "5000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const PASSWORD = "OfficerGeofenceTest123!";

// Site location (central London) and the geofence radius we seed on the tenant.
const SITE_LAT = 51.5074;
const SITE_LNG = -0.1278;
const GEOFENCE_RADIUS = 200;
// A very wide check-in/out time window so the test is not time-of-day flaky.
const TIME_WINDOW_MINUTES = 100000;

let pool: Pool;

const seeded: {
  tenantId?: number;
  siteId?: number;
  username?: string;
  userId?: string;
  employeeId?: number;
  shiftId?: number;
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
    `INSERT INTO tenants (name, slug, industry, is_active, geofence_radius_metres, checkin_time_window_minutes)
     VALUES ($1, $2, 'security', true, $3, $4) RETURNING id`,
    [`E2E Officer Geo ${suffix}`, `e2e-officer-geo-${suffix}`, GEOFENCE_RADIUS, TIME_WINDOW_MINUTES],
  );
  seeded.tenantId = tenant.rows[0].id;

  const site = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, latitude, longitude, is_active)
     VALUES ($1, $2, '1 Geo Street', 'London', 'EC1A 1AA', $3, $4, true) RETURNING id`,
    [seeded.tenantId, `E2E Officer Geo Site ${suffix}`, String(SITE_LAT), String(SITE_LNG)],
  );
  seeded.siteId = site.rows[0].id;

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const username = `officer_geo_${suffix}`;
  const email = `${username}@e2e.test`;
  const user = await pool.query(
    `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'Geo', 'Officer', 'employee', true) RETURNING id`,
    [seeded.tenantId, username, email, hashed],
  );
  seeded.username = username;
  seeded.userId = user.rows[0].id;

  const employee = await pool.query(
    `INSERT INTO employees (tenant_id, user_id, employee_number, job_title)
     VALUES ($1, $2, $3, 'Security Officer') RETURNING id`,
    [seeded.tenantId, seeded.userId, `EMP-GEO-${suffix}`],
  );
  seeded.employeeId = employee.rows[0].id;

  const today = new Date().toISOString().split("T")[0];
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const shift = await pool.query(
    `INSERT INTO shifts (tenant_id, site_id, employee_id, title, date, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled') RETURNING id`,
    [seeded.tenantId, seeded.siteId, seeded.employeeId, `Shift GEO-${suffix}`, today, nowHHMM, nowHHMM],
  );
  seeded.shiftId = shift.rows[0].id;

  // Check-in requires a passed pre-shift ops check for this employee + shift.
  await pool.query(
    `INSERT INTO ops_checks (tenant_id, employee_id, shift_id, checklist, all_passed, completed_at)
     VALUES ($1, $2, $3, $4::jsonb, true, NOW())`,
    [
      seeded.tenantId,
      seeded.employeeId,
      seeded.shiftId,
      JSON.stringify([{ itemId: 1, label: "Uniform", checked: true }]),
    ],
  );
});

test.afterAll(async () => {
  if (!pool) return;
  const t = seeded.tenantId;
  if (t) {
    await pool.query("DELETE FROM ops_checks WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM shifts WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM employees WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM sites WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM audit_logs WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [t]).catch(() => {});
    await pool.query("DELETE FROM tenants WHERE id = $1", [t]).catch(() => {});
  }
  await pool.end();
});

test("officer check-in/out is rejected without GPS and outside the site geofence, accepted within it", async () => {
  const ctx = await loginContext(seeded.username!);
  const checkinUrl = `/api/my-shifts/${seeded.shiftId}/checkin`;
  const checkoutUrl = `/api/my-shifts/${seeded.shiftId}/checkout`;

  try {
    // (a) Check-in without lat/lng is rejected with 400.
    const noLocation = await ctx.post(checkinUrl, { data: {} });
    expect(noLocation.status(), "missing GPS should be rejected").toBe(400);

    // (b) Out-of-range coordinates are rejected with 400.
    const outOfRange = await ctx.post(checkinUrl, {
      data: { lat: 200, lng: 400 },
    });
    expect(outOfRange.status(), "invalid coordinates should be rejected").toBe(400);

    // Nothing should have been persisted to the shift yet.
    const beforeRow = await pool.query(
      "SELECT status, last_check_in_lat, check_in_distance_metres FROM shifts WHERE id = $1",
      [seeded.shiftId],
    );
    expect(beforeRow.rows[0].status).toBe("scheduled");
    expect(beforeRow.rows[0].last_check_in_lat).toBeNull();

    // (c) Check-in far from the site: accepted (200) but flagged outside the geofence.
    const FAR_LAT = 52.4862; // Birmingham — well over 100km away.
    const FAR_LNG = -1.8904;
    const farCheckIn = await ctx.post(checkinUrl, {
      data: { lat: FAR_LAT, lng: FAR_LNG },
    });
    expect(farCheckIn.status(), "far check-in should still succeed").toBe(200);
    const farBody = await farCheckIn.json();
    expect(farBody.withinRange, "far check-in should be flagged outside range").toBe(false);
    expect(typeof farBody.distanceFromSite).toBe("number");
    expect(farBody.distanceFromSite).toBeGreaterThan(GEOFENCE_RADIUS);
    expect(farBody.geofenceRadius).toBe(GEOFENCE_RADIUS);

    // The check-in lat/lng/distance columns are persisted on the shift.
    const afterCheckIn = await pool.query(
      `SELECT status, last_check_in_lat, last_check_in_lng, check_in_distance_metres
       FROM shifts WHERE id = $1`,
      [seeded.shiftId],
    );
    const ci = afterCheckIn.rows[0];
    expect(ci.status).toBe("in_progress");
    expect(parseFloat(ci.last_check_in_lat)).toBeCloseTo(FAR_LAT, 4);
    expect(parseFloat(ci.last_check_in_lng)).toBeCloseTo(FAR_LNG, 4);
    expect(parseFloat(ci.check_in_distance_metres)).toBeGreaterThan(GEOFENCE_RADIUS);

    // An employee_self_checkin audit row is written, with withinRange=false in details.
    const checkinAudit = await pool.query(
      `SELECT details FROM audit_logs
       WHERE tenant_id = $1 AND action = 'employee_self_checkin' AND entity_type = 'shift' AND entity_id = $2`,
      [seeded.tenantId, String(seeded.shiftId)],
    );
    expect(checkinAudit.rows.length).toBeGreaterThanOrEqual(1);
    expect(checkinAudit.rows[0].details.withinRange).toBe(false);

    // (d) Check-out within the geofence radius: withinRange true.
    const nearCheckOut = await ctx.post(checkoutUrl, {
      data: { lat: SITE_LAT, lng: SITE_LNG },
    });
    expect(nearCheckOut.status(), "near check-out should succeed").toBe(200);
    const nearBody = await nearCheckOut.json();
    expect(nearBody.withinRange, "near check-out should be within range").toBe(true);
    expect(typeof nearBody.distanceFromSite).toBe("number");
    expect(nearBody.distanceFromSite).toBeLessThanOrEqual(GEOFENCE_RADIUS);

    // The check-out columns are persisted on the shift.
    const afterCheckOut = await pool.query(
      `SELECT status, last_check_out_lat, last_check_out_lng, check_out_distance_metres
       FROM shifts WHERE id = $1`,
      [seeded.shiftId],
    );
    const co = afterCheckOut.rows[0];
    expect(co.status).toBe("completed");
    expect(parseFloat(co.last_check_out_lat)).toBeCloseTo(SITE_LAT, 4);
    expect(parseFloat(co.last_check_out_lng)).toBeCloseTo(SITE_LNG, 4);
    expect(parseFloat(co.check_out_distance_metres)).toBeLessThanOrEqual(GEOFENCE_RADIUS);

    // An employee_self_checkout audit row is written, with withinRange=true in details.
    const checkoutAudit = await pool.query(
      `SELECT details FROM audit_logs
       WHERE tenant_id = $1 AND action = 'employee_self_checkout' AND entity_type = 'shift' AND entity_id = $2`,
      [seeded.tenantId, String(seeded.shiftId)],
    );
    expect(checkoutAudit.rows.length).toBeGreaterThanOrEqual(1);
    expect(checkoutAudit.rows[0].details.withinRange).toBe(true);
  } finally {
    await ctx.dispose();
  }
});
