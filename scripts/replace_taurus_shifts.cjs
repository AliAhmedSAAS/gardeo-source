const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = 7;
  const supplierId = 48;
  const payRate = 10.5;

  console.log("=== Replace Taurus Investigation and Protection Services Ltd shifts ===");
  console.log("Supplier ID: 48, Tenant ID: 7");
  console.log("Step 1: Delete all existing Taurus shifts");
  console.log("Step 2: Import 162 shifts from new CSV\n");

  const shiftSubquery = `(SELECT id FROM shifts WHERE supplier_id = $1 AND tenant_id = $2)`;

  const delDisputes = await pool.query(`DELETE FROM disputes WHERE shift_id IN ${shiftSubquery}`, [supplierId, tenantId]);
  console.log(`Deleted ${delDisputes.rowCount} related disputes.`);

  const delInvLines = await pool.query(`DELETE FROM invoice_line_items WHERE shift_id IN ${shiftSubquery}`, [supplierId, tenantId]);
  console.log(`Deleted ${delInvLines.rowCount} related invoice line items.`);

  const delPayrollItems = await pool.query(`DELETE FROM payroll_run_items WHERE shift_id IN ${shiftSubquery}`, [supplierId, tenantId]);
  console.log(`Deleted ${delPayrollItems.rowCount} related payroll run items.`);

  const delClientInvLines = await pool.query(`DELETE FROM client_invoice_line_items WHERE shift_id IN ${shiftSubquery}`, [supplierId, tenantId]);
  console.log(`Deleted ${delClientInvLines.rowCount} related client invoice line items.`);

  const delControllerLog = await pool.query(`DELETE FROM controller_activity_log WHERE shift_id IN ${shiftSubquery}`, [supplierId, tenantId]);
  console.log(`Deleted ${delControllerLog.rowCount} related controller activity log entries.`);

  const deleteRes = await pool.query(
    `DELETE FROM shifts WHERE supplier_id = $1 AND tenant_id = $2`,
    [supplierId, tenantId]
  );
  console.log(`Deleted ${deleteRes.rowCount} existing Taurus shifts.\n`);

  const siteData = [
    { extId: "4177", name: "Portsmouth Combined PO1 2EB", address: "Portsmouth Combined", postcode: "PO1 2EB" },
    { extId: "4802", name: "Chichester Combined Court PO19 1SX", address: "Chichester Combined Court", postcode: "PO19 1SX" },
    { extId: "3884", name: "Portsmouth Magistrates Hampshire PO1 2DQ", address: "Portsmouth Magistrates", postcode: "PO1 2DQ" },
    { extId: "4300", name: "Chichester ACTC West Sussex PO19 1TY", address: "Chichester ACTC", postcode: "PO19 1TY" },
    { extId: "4299", name: "Worthing Magistrates West Sussex BN11 1JE", address: "Worthing Magistrates", postcode: "BN11 1JE" },
    { extId: "5669", name: "Matalan Waterlooville PO7 7UL", address: "Matalan Waterlooville", postcode: "PO7 7UL" },
    { extId: "4391", name: "Havant Magistrates PO9 2AL", address: "Havant Magistrates", postcode: "PO9 2AL" },
  ];

  const siteMap = {};
  for (const s of siteData) {
    let res = await pool.query(`SELECT id FROM sites WHERE external_id = $1 AND tenant_id = $2`, [s.extId, tenantId]);
    if (res.rows.length === 0) {
      res = await pool.query(
        `INSERT INTO sites (tenant_id, name, address, postcode, external_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, s.name, s.address, s.postcode, s.extId]
      );
      console.log(`Created site ${s.extId} (${s.postcode}): ID ${res.rows[0].id}`);
    } else {
      console.log(`Found site ${s.extId} (${s.postcode}): ID ${res.rows[0].id}`);
    }
    siteMap[s.extId] = res.rows[0].id;
  }

  const officers = [
    { extId: "24290", first: "DIGANT", last: "KAPADIYA" },
    { extId: "17713", first: "LEE", last: "KNIGHT" },
    { extId: "17781", first: "KIRSTY", last: "IRWIN" },
    { extId: "21496", first: "JACK", last: "DAWE" },
    { extId: "25062", first: "PRIYANKA", last: "PATEL" },
    { extId: "25582", first: "THOMAS", last: "SEARLE" },
    { extId: "21752", first: "ROBIN", last: "JENKINSON" },
    { extId: "17907", first: "JOE", last: "DAVID" },
    { extId: "18581", first: "NIGEL", last: "GOLDING" },
    { extId: "14294", first: "JOSHUA", last: "DAVEY" },
    { extId: "25675", first: "U", last: "OKONKWO" },
    { extId: "21363", first: "JOHN", last: "CASEY" },
    { extId: "21700", first: "LEIGH", last: "WATTERS" },
    { extId: "22136", first: "CODY", last: "COWAN" },
    { extId: "17108", first: "CALLUM", last: "GORE" },
    { extId: "23829", first: "ABHISHEKTH", last: "GUNDARAM" },
  ];

  const empMap = {};
  for (const o of officers) {
    let empRes = await pool.query(`SELECT id FROM employees WHERE external_id = $1 AND tenant_id = $2`, [o.extId, tenantId]);
    if (empRes.rows.length === 0) {
      const username = `taurus_${o.extId}`;
      const email = `${username}@placeholder.local`;
      const userRes = await pool.query(
        `INSERT INTO users (id, username, email, password, first_name, last_name, role, tenant_id)
         VALUES (gen_random_uuid(), $1, $2, 'not_set', $3, $4, 'employee', $5) RETURNING id`,
        [username, email, o.first, o.last, tenantId]
      );
      empRes = await pool.query(
        `INSERT INTO employees (user_id, tenant_id, supplier_id, external_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userRes.rows[0].id, tenantId, supplierId, o.extId]
      );
      console.log(`Created employee ${o.first} ${o.last} (ext ${o.extId}): emp ${empRes.rows[0].id}`);
    } else {
      await pool.query(`UPDATE employees SET supplier_id = $1 WHERE id = $2`, [supplierId, empRes.rows[0].id]);
      console.log(`Found employee ${o.first} ${o.last} (ext ${o.extId}): emp ${empRes.rows[0].id}`);
    }
    empMap[o.extId] = empRes.rows[0].id;
  }

  const csvPath = "attached_assets/Taurus__1774244199106.csv";
  const csvData = fs.readFileSync(csvPath, "utf8");
  const lines = csvData.replace(/^\uFEFF/, "").trim().split("\n").slice(1);

  function parseUKDT(dt) {
    const [datePart, timePart] = dt.trim().split(" ");
    const [d, m, y] = datePart.split("/");
    return `${y}-${m}-${d} ${timePart}`;
  }

  console.log(`\nImporting ${lines.length} shifts from CSV...`);
  let inserted = 0;
  let skipped = 0;
  let failures = [];

  for (const line of lines) {
    const parts = line.split(",");
    const extId = parts[0].trim();
    const officerExt = parts[1].trim();
    const locationId = parts[8].trim();
    const empId = empMap[officerExt];
    const siteId = siteMap[locationId];

    if (!empId) {
      failures.push(`Shift ${extId}: no employee found for officer_id ${officerExt}`);
      continue;
    }
    if (!siteId) {
      failures.push(`Shift ${extId}: no site found for LocationID ${locationId}`);
      continue;
    }

    const dutyStart = parts[6].trim();
    const dutyFinish = parts[7].trim();
    const [sd, sm, sy] = parts[5].trim().split("/");
    const shiftDate = `${sy}-${sm}-${sd}`;
    const checkIn = parseUKDT(dutyStart);
    const checkOut = parseUKDT(dutyFinish);
    const startTime = dutyStart.split(" ")[1];
    const endTime = dutyFinish.split(" ")[1];
    const title = parts[9].trim().substring(0, 50);

    try {
      const res = await pool.query(
        `INSERT INTO shifts (tenant_id, site_id, employee_id, supplier_id, title, date, start_time, end_time, break_minutes, status, external_id, supplier_approval_status, pay_rate, check_in_time, check_out_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'completed', $9, 'approved', $10, $11::timestamp, $12::timestamp)
         ON CONFLICT DO NOTHING RETURNING id`,
        [tenantId, siteId, empId, supplierId, title, shiftDate, startTime, endTime, extId, payRate, checkIn, checkOut]
      );
      if (res.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      failures.push(`Shift ${extId}: ${err.message}`);
    }
  }

  const expectedCount = lines.length;
  const totalProcessed = inserted + skipped + failures.length;

  console.log(`\n=== Summary ===`);
  console.log(`Shifts deleted: ${deleteRes.rowCount}`);
  console.log(`CSV rows: ${expectedCount}`);
  console.log(`Shifts inserted: ${inserted}`);
  console.log(`Shifts skipped (duplicate): ${skipped}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`\nFailure details:`);
    failures.forEach(f => console.log(`  - ${f}`));
  }

  const verifyRes = await pool.query(
    `SELECT COUNT(*)::int as count FROM shifts WHERE supplier_id = $1 AND tenant_id = $2`,
    [supplierId, tenantId]
  );
  const dbCount = verifyRes.rows[0].count;
  console.log(`\nPost-import verification: ${dbCount} Taurus shifts in database.`);

  await pool.end();

  if (totalProcessed !== expectedCount) {
    console.error(`ERROR: Processed ${totalProcessed} rows but CSV had ${expectedCount}. Mismatch!`);
    process.exit(1);
  }
  if (inserted !== expectedCount) {
    console.error(`ERROR: Expected ${expectedCount} inserts but only got ${inserted}. (${skipped} skipped, ${failures.length} failed)`);
    process.exit(1);
  }
  if (dbCount !== expectedCount) {
    console.error(`ERROR: Expected ${expectedCount} shifts in DB but found ${dbCount}.`);
    process.exit(1);
  }
  console.log("All validations passed.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
