import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * End-to-end coverage for the FM operative portal.
 *
 * Flow under test (client/src/pages/fm-worker-portal.tsx + fm-worker-job.tsx,
 * server routes /api/fm/me, /api/fm/my-jobs*):
 *   login -> redirect to /fm-worker -> open assigned job -> start work ->
 *   attach a photo -> add completion notes -> mark complete.
 *
 * The test seeds its own isolated tenant (with the fm_services add-on active),
 * an employee user, an FM worker linked to that user, a site, an FM job and the
 * assignment that ties the worker to the job. Everything created is torn down in
 * afterAll so the dev database is left clean.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const PASSWORD = "FmWorkerTest123!";

let pool: Pool;

// Seeded record ids / values, populated in beforeAll.
const seeded: {
  tenantId?: number;
  userId?: string;
  username?: string;
  workerId?: number;
  siteId?: number;
  jobId?: number;
  assignmentId?: number;
  pauseJobId?: number;
  pauseAssignmentId?: number;
  offsiteSiteId?: number;
  offsiteJobId?: number;
  offsiteAssignmentId?: number;
} = {};

// Coordinates used by the off-site test. The site sits in central London while
// the worker's GPS is forced to New York — well beyond the 200m default
// geofence — so the check-in is flagged as off-site.
const OFFSITE_SITE_LAT = 51.5074;
const OFFSITE_SITE_LNG = -0.1278;
const OFFSITE_WORKER_LAT = 40.7128;
const OFFSITE_WORKER_LNG = -74.006;

const COMPLETION_NOTES =
  "Replaced faulty light fitting in reception and tested. All working. (e2e)";

const PAUSE_NOTES =
  "Isolated the tripped circuit, parts on order. Pausing until the new RCD arrives. (e2e)";

// A tiny valid 1x1 PNG used as the uploaded job photo.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

test.beforeAll(async () => {
  test.skip(!DATABASE_URL, "DATABASE_URL not set");
  pool = new Pool({ connectionString: DATABASE_URL });

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const today = new Date().toISOString().split("T")[0];

  // Isolated tenant with the FM add-on switched on.
  const tenant = await pool.query(
    `INSERT INTO tenants (name, slug, industry, is_active)
     VALUES ($1, $2, 'cleaning', true) RETURNING id`,
    [`E2E FM Tenant ${suffix}`, `e2e-fm-${suffix}`],
  );
  seeded.tenantId = tenant.rows[0].id;

  await pool.query(
    `INSERT INTO tenant_addons (tenant_id, addon_key, addon_name, status)
     VALUES ($1, 'fm_services', 'FM Services', 'active')`,
    [seeded.tenantId],
  );

  // Employee user that will sign into the operative portal.
  const hashed = await bcrypt.hash(PASSWORD, 10);
  seeded.username = `fmworker_${suffix}`;
  const email = `fmworker_${suffix}@e2e.test`;
  const user = await pool.query(
    `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'Frankie', 'Field', 'employee', true) RETURNING id`,
    [seeded.tenantId, seeded.username, email, hashed],
  );
  seeded.userId = user.rows[0].id;

  // Site the job is attached to.
  const site = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, is_active)
     VALUES ($1, $2, '1 Test Street', 'London', 'EC1A 1AA', true) RETURNING id`,
    [seeded.tenantId, `E2E FM Site ${suffix}`],
  );
  seeded.siteId = site.rows[0].id;

  // FM worker linked to the user (user_id is checked first by getFmWorkerForUser).
  const worker = await pool.query(
    `INSERT INTO fm_workers (tenant_id, user_id, first_name, last_name, email, trade, service_line, is_active)
     VALUES ($1, $2, 'Frankie', 'Field', $3, 'electrician', 'maintenance', true) RETURNING id`,
    [seeded.tenantId, seeded.userId, email],
  );
  seeded.workerId = worker.rows[0].id;

  // An open job scheduled for today so it shows in the "Today" section.
  const job = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, $5, 'reactive', 'maintenance', 'high', 'assigned', $6) RETURNING id`,
    [
      seeded.tenantId,
      seeded.siteId,
      `E2E-${suffix}`,
      "Reception light not working",
      "Tenant reports flickering light in reception. Investigate and repair.",
      today,
    ],
  );
  seeded.jobId = job.rows[0].id;

  // Assign the job to the worker.
  const assignment = await pool.query(
    `INSERT INTO fm_job_assignments (tenant_id, job_id, worker_id, role, status)
     VALUES ($1, $2, $3, 'worker', 'assigned') RETURNING id`,
    [seeded.tenantId, seeded.jobId, seeded.workerId],
  );
  seeded.assignmentId = assignment.rows[0].id;

  // A second open job used by the pause/resume test so it is independent of the
  // happy-path test (which completes its own job).
  const pauseJob = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, $5, 'reactive', 'maintenance', 'medium', 'assigned', $6) RETURNING id`,
    [
      seeded.tenantId,
      seeded.siteId,
      `E2E-PAUSE-${suffix}`,
      "Faulty RCD in plant room",
      "Tenant reports nuisance tripping. Investigate, isolate and repair when parts arrive.",
      today,
    ],
  );
  seeded.pauseJobId = pauseJob.rows[0].id;

  const pauseAssignment = await pool.query(
    `INSERT INTO fm_job_assignments (tenant_id, job_id, worker_id, role, status)
     VALUES ($1, $2, $3, 'worker', 'assigned') RETURNING id`,
    [seeded.tenantId, seeded.pauseJobId, seeded.workerId],
  );
  seeded.pauseAssignmentId = pauseAssignment.rows[0].id;

  // A site with a known lat/lng so the geofence check has something to measure
  // against. Used only by the off-site test (latitude/longitude are text cols).
  const offsiteSite = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, city, postcode, latitude, longitude, is_active)
     VALUES ($1, $2, '10 Geofence Way', 'London', 'EC1A 1AA', $3, $4, true) RETURNING id`,
    [seeded.tenantId, `E2E FM Offsite Site ${suffix}`, String(OFFSITE_SITE_LAT), String(OFFSITE_SITE_LNG)],
  );
  seeded.offsiteSiteId = offsiteSite.rows[0].id;

  const offsiteJob = await pool.query(
    `INSERT INTO fm_jobs
       (tenant_id, site_id, job_number, title, description, job_type, service_line, priority, status, scheduled_date)
     VALUES ($1, $2, $3, $4, $5, 'reactive', 'maintenance', 'high', 'assigned', $6) RETURNING id`,
    [
      seeded.tenantId,
      seeded.offsiteSiteId,
      `E2E-OFFSITE-${suffix}`,
      "Boiler service",
      "Annual boiler service. Worker must attend site to carry out the work.",
      today,
    ],
  );
  seeded.offsiteJobId = offsiteJob.rows[0].id;

  const offsiteAssignment = await pool.query(
    `INSERT INTO fm_job_assignments (tenant_id, job_id, worker_id, role, status)
     VALUES ($1, $2, $3, 'worker', 'assigned') RETURNING id`,
    [seeded.tenantId, seeded.offsiteJobId, seeded.workerId],
  );
  seeded.offsiteAssignmentId = offsiteAssignment.rows[0].id;
});

test.afterAll(async () => {
  if (!pool) return;
  const t = seeded.tenantId;
  if (t) {
    // Delete in FK-safe order. Everything below references only this test tenant.
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

test("FM operative completes an assigned job end-to-end", async ({ page, context }) => {
  // Start/complete capture GPS, so grant a fixed location for deterministic runs.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

  // --- Login ---
  await page.goto("/login");
  await page.getByTestId("input-username").fill(seeded.username!);
  await page.getByTestId("input-password").fill(PASSWORD);
  await page.getByTestId("button-login").click();

  // Linked FM workers are redirected straight to the operative portal.
  await page.waitForURL("**/fm-worker", { timeout: 20_000 });
  await expect(page.getByTestId("fm-worker-portal")).toBeVisible();

  // The seeded job shows up and we open it.
  const jobCard = page.getByTestId(`card-job-${seeded.jobId}`);
  await expect(jobCard).toBeVisible();
  await jobCard.click();

  await page.waitForURL(`**/fm-worker/jobs/${seeded.jobId}`, { timeout: 20_000 });
  await expect(page.getByTestId("fm-worker-job-page")).toBeVisible();
  await expect(page.getByTestId("badge-status")).toHaveText(/assigned/i);

  // --- Start work ---
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/in progress/i);

  // --- Attach a photo ---
  await page.getByTestId("input-photo-file").setInputFiles({
    name: "job-photo.png",
    mimeType: "image/png",
    buffer: PNG_1x1,
  });
  // Once uploaded the photo grid renders an image with a remove button.
  await expect(page.locator('[data-testid^="photo-"]').first()).toBeVisible({ timeout: 20_000 });

  // --- Add completion notes ---
  await page.getByTestId("input-notes").fill(COMPLETION_NOTES);

  // --- Mark complete ---
  await page.getByTestId("button-complete").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/completed/i);
  await expect(page.getByTestId("text-completion-notes")).toContainText(COMPLETION_NOTES);

  // --- Verify persistence in the database ---
  const { rows } = await pool.query(
    `SELECT status, completion_notes, photo_urls, started_at, completed_at
     FROM fm_jobs WHERE id = $1`,
    [seeded.jobId],
  );
  expect(rows).toHaveLength(1);
  const job = rows[0];
  expect(job.status).toBe("completed");
  expect(job.completion_notes).toBe(COMPLETION_NOTES);
  expect(Array.isArray(job.photo_urls)).toBe(true);
  expect(job.photo_urls.length).toBeGreaterThan(0);
  expect(job.started_at).not.toBeNull();
  expect(job.completed_at).not.toBeNull();

  // The assignment should mirror the job lifecycle (check-in on start, check-out on complete).
  const { rows: aRows } = await pool.query(
    `SELECT status, check_in_at, check_out_at FROM fm_job_assignments WHERE id = $1`,
    [seeded.assignmentId],
  );
  expect(aRows[0].status).toBe("completed");
  expect(aRows[0].check_in_at).not.toBeNull();
  expect(aRows[0].check_out_at).not.toBeNull();
});

test("FM operative pauses a job and later resumes and completes it", async ({ page, context }) => {
  // Start/complete capture GPS, so grant a fixed location for deterministic runs.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

  // --- Login ---
  await page.goto("/login");
  await page.getByTestId("input-username").fill(seeded.username!);
  await page.getByTestId("input-password").fill(PASSWORD);
  await page.getByTestId("button-login").click();

  await page.waitForURL("**/fm-worker", { timeout: 20_000 });
  await expect(page.getByTestId("fm-worker-portal")).toBeVisible();

  // Open the dedicated pause/resume job.
  const openPauseJob = async () => {
    const card = page.getByTestId(`card-job-${seeded.pauseJobId}`);
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL(`**/fm-worker/jobs/${seeded.pauseJobId}`, { timeout: 20_000 });
    await expect(page.getByTestId("fm-worker-job-page")).toBeVisible();
  };

  await openPauseJob();
  await expect(page.getByTestId("badge-status")).toHaveText(/assigned/i);

  // --- Start work --- (refetch resets the form to the server state)
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/in progress/i);

  // --- Add notes + a photo while mid-job ---
  await page.getByTestId("input-notes").fill(PAUSE_NOTES);
  await page.getByTestId("input-photo-file").setInputFiles({
    name: "progress.png",
    mimeType: "image/png",
    buffer: PNG_1x1,
  });
  await expect(page.locator('[data-testid^="photo-"]').first()).toBeVisible({ timeout: 20_000 });

  // --- Pause --- notes + photos are persisted as part of the pause request.
  await page.getByTestId("button-pause").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/on hold/i);
  // The paused banner only renders for on_hold open jobs.
  await expect(page.getByText(/Job paused — start again/i)).toBeVisible();

  // The Pause action must persist the draft notes/photos to the database.
  const { rows: pausedRows } = await pool.query(
    `SELECT status, completion_notes, photo_urls FROM fm_jobs WHERE id = $1`,
    [seeded.pauseJobId],
  );
  expect(pausedRows).toHaveLength(1);
  expect(pausedRows[0].status).toBe("on_hold");
  expect(pausedRows[0].completion_notes).toBe(PAUSE_NOTES);
  expect(Array.isArray(pausedRows[0].photo_urls)).toBe(true);
  expect(pausedRows[0].photo_urls.length).toBeGreaterThan(0);
  const photosAfterPause: string[] = pausedRows[0].photo_urls;

  // --- Reopen the job ---
  // Navigate back to the list (the paused job should still be listed there)...
  await page.getByTestId("link-back").click();
  await page.waitForURL("**/fm-worker", { timeout: 20_000 });
  await openPauseJob();
  // ...then reload to simulate a worker reopening the app later with a clean
  // cache, which forces a fresh fetch and rehydrates the saved draft state.
  await page.reload();
  await expect(page.getByTestId("fm-worker-job-page")).toBeVisible();

  // Still on hold, and the saved notes + photos are restored from the server.
  await expect(page.getByTestId("badge-status")).toHaveText(/on hold/i);
  await expect(page.getByTestId("input-notes")).toHaveValue(PAUSE_NOTES);
  await expect(page.locator('[data-testid^="photo-"]').first()).toBeVisible();

  // --- Resume (start again) and complete ---
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/in progress/i);

  // Notes survive the resume refetch, so completion can proceed straight away.
  await expect(page.getByTestId("input-notes")).toHaveValue(PAUSE_NOTES);
  await page.getByTestId("button-complete").click();
  await expect(page.getByTestId("badge-status")).toHaveText(/completed/i);
  await expect(page.getByTestId("text-completion-notes")).toContainText(PAUSE_NOTES);

  // --- DB assertions: notes/photos survived the full pause -> resume -> complete cycle ---
  const { rows: doneRows } = await pool.query(
    `SELECT status, completion_notes, photo_urls, started_at, completed_at FROM fm_jobs WHERE id = $1`,
    [seeded.pauseJobId],
  );
  expect(doneRows).toHaveLength(1);
  const doneJob = doneRows[0];
  expect(doneJob.status).toBe("completed");
  expect(doneJob.completion_notes).toBe(PAUSE_NOTES);
  expect(Array.isArray(doneJob.photo_urls)).toBe(true);
  expect(doneJob.photo_urls.length).toBeGreaterThan(0);
  expect(doneJob.photo_urls).toEqual(photosAfterPause);
  expect(doneJob.started_at).not.toBeNull();
  expect(doneJob.completed_at).not.toBeNull();
});

test("FM operative starting a job off-site is flagged to their manager", async ({ page, context }) => {
  // Grant geolocation but force a position far outside the site's geofence so
  // the start is recorded as off-site (the site is in London, the worker in NY).
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: OFFSITE_WORKER_LAT, longitude: OFFSITE_WORKER_LNG });

  // --- Login ---
  await page.goto("/login");
  await page.getByTestId("input-username").fill(seeded.username!);
  await page.getByTestId("input-password").fill(PASSWORD);
  await page.getByTestId("button-login").click();

  await page.waitForURL("**/fm-worker", { timeout: 20_000 });
  await expect(page.getByTestId("fm-worker-portal")).toBeVisible();

  // Open the off-site job.
  const jobCard = page.getByTestId(`card-job-${seeded.offsiteJobId}`);
  await expect(jobCard).toBeVisible();
  await jobCard.click();

  await page.waitForURL(`**/fm-worker/jobs/${seeded.offsiteJobId}`, { timeout: 20_000 });
  await expect(page.getByTestId("fm-worker-job-page")).toBeVisible();
  await expect(page.getByTestId("badge-status")).toHaveText(/assigned/i);

  // --- Start work --- the off-site warning toast must appear...
  await page.getByTestId("button-start").click();
  await expect(page.getByText(/Started — but you're off-site/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/flagged to your manager/i).first()).toBeVisible();

  // ...and the job must still move into progress despite being off-site.
  await expect(page.getByTestId("badge-status")).toHaveText(/in progress/i);

  // --- DB assertions: the job started and the assignment captured the off-site check-in ---
  const { rows: jobRows } = await pool.query(
    `SELECT status, started_at FROM fm_jobs WHERE id = $1`,
    [seeded.offsiteJobId],
  );
  expect(jobRows).toHaveLength(1);
  expect(jobRows[0].status).toBe("in_progress");
  expect(jobRows[0].started_at).not.toBeNull();

  const { rows: aRows } = await pool.query(
    `SELECT check_in_within_range, check_in_distance_metres, check_in_at FROM fm_job_assignments WHERE id = $1`,
    [seeded.offsiteAssignmentId],
  );
  expect(aRows).toHaveLength(1);
  expect(aRows[0].check_in_within_range).toBe(false);
  expect(aRows[0].check_in_at).not.toBeNull();
  expect(aRows[0].check_in_distance_metres).not.toBeNull();
  // London <-> New York is millions of metres, comfortably outside the 200m geofence.
  expect(Number(aRows[0].check_in_distance_metres)).toBeGreaterThan(200);

  // The off-site check-in must be recorded in the audit log for the manager.
  const { rows: auditRows } = await pool.query(
    `SELECT details FROM audit_logs
     WHERE tenant_id = $1 AND action = 'fm_worker_checkin' AND entity_type = 'fm_job' AND entity_id = $2`,
    [seeded.tenantId, String(seeded.offsiteJobId)],
  );
  expect(auditRows.length).toBeGreaterThan(0);
  const details = auditRows[0].details;
  expect(details.withinRange).toBe(false);
  expect(details.workerId).toBe(seeded.workerId);
});
