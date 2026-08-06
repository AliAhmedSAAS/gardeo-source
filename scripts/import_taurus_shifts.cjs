const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = 7;
  const supplierId = 48;
  const payRate = 10.5;

  console.log("=== Taurus Investigation and Protection Services Ltd shift import ===");
  console.log("Supplier ID: 48, External ID: 4513");
  console.log("162 shifts, Jul-Aug 2022, rate: £10.50/hr");
  console.log("16 officers, 7 sites");

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
    }
    siteMap[s.extId] = res.rows[0].id;
    console.log(`Site ${s.extId} (${s.postcode}): ID ${siteMap[s.extId]}`);
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
    } else {
      await pool.query(`UPDATE employees SET supplier_id = $1 WHERE id = $2`, [supplierId, empRes.rows[0].id]);
    }
    empMap[o.extId] = empRes.rows[0].id;
    console.log(`${o.first} ${o.last} (ext ${o.extId}): emp ${empMap[o.extId]}`);
  }

  const csvPath = process.argv[2] || "attached_assets/Taurus_Investigation_and_Protection_Services_Ltd_1773277238488.csv";
  const csvData = fs.readFileSync(csvPath, "utf8");
  const rows = csvData.trim().split("\n").slice(1);

  function parseUKDT(dt) {
    const [datePart, timePart] = dt.trim().split(" ");
    const [d, m, y] = datePart.split("/");
    return `${y}-${m}-${d} ${timePart}`;
  }

  console.log(`\nImporting ${rows.length} shifts...`);
  let inserted = 0;

  for (const row of rows) {
    const parts = row.split(",");
    const extId = parts[0].trim();
    const officerExt = parts[1].trim();
    const locationId = parts[8].trim();
    const empId = empMap[officerExt];
    const siteId = siteMap[locationId];
    const dutyStart = parts[6].trim();
    const dutyFinish = parts[7].trim();
    const [sd, sm, sy] = parts[5].trim().split("/");
    const shiftDate = `${sy}-${sm}-${sd}`;
    const checkIn = parseUKDT(dutyStart);
    const checkOut = parseUKDT(dutyFinish);
    const startTime = dutyStart.split(" ")[1];
    const endTime = dutyFinish.split(" ")[1];
    const title = parts[9].trim().substring(0, 50);

    const res = await pool.query(
      `INSERT INTO shifts (tenant_id, site_id, employee_id, supplier_id, title, date, start_time, end_time, break_minutes, status, external_id, supplier_approval_status, pay_rate, check_in_time, check_out_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'completed', $9, 'approved', $10, $11::timestamp, $12::timestamp)
       ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId, siteId, empId, supplierId, title, shiftDate, startTime, endTime, extId, payRate, checkIn, checkOut]
    );
    if (res.rowCount > 0) inserted++;
  }

  console.log(`Done: ${inserted} shifts inserted, all marked approved at £${payRate}/hr.`);
  await pool.end();
}

main().catch(console.error);
