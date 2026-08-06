const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = 7;
  const supplierId = 67;

  console.log("=== ABEESO Security and Cleaning Services Ltd shift import ===");
  console.log("Supplier ID: 67, External ID: 1121");
  console.log("303 shifts, Feb 2022, rate: £11.50/hr");
  console.log("9 officers, 2 sites (Liverpool)");

  const siteData = [
    { extId: "5857", name: "101 Old Hall 101 Old Hall Street Liverpool L3 9BD", postcode: "L3 9BD" },
    { extId: "6219", name: "101 Old Hall Street Liverpool L3 9BD", postcode: "L3 9BD" },
  ];

  const siteMap = {};
  for (const s of siteData) {
    let res = await pool.query(`SELECT id FROM sites WHERE external_id = $1 AND tenant_id = $2`, [s.extId, tenantId]);
    if (res.rows.length === 0) {
      res = await pool.query(
        `INSERT INTO sites (tenant_id, name, address, postcode, external_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, s.name, s.name, s.postcode, s.extId]
      );
    }
    siteMap[s.extId] = res.rows[0].id;
    console.log(`Site ${s.extId}: ID ${siteMap[s.extId]}`);
  }

  const officers = [
    { extId: "30234", first: "ABDUL", last: "HASEEB" },
    { extId: "30336", first: "MD", last: "MIZANUR RAHMAN" },
    { extId: "30238", first: "OGHENEKARO", last: "RUGBERE" },
    { extId: "1121", first: "OSMAN", last: "ABDULLE" },
    { extId: "13664", first: "MUSTAFA", last: "SUMRA" },
    { extId: "13665", first: "IDRIES", last: "MOFTAH" },
    { extId: "19253", first: "QAMAR", last: "AHMAD" },
    { extId: "16100", first: "KARIM", last: "NATHAMI-P" },
    { extId: "16254", first: "NIKOLA", last: "CUBRILO" },
  ];

  const empMap = {};
  for (const o of officers) {
    let empRes = await pool.query(`SELECT id FROM employees WHERE external_id = $1 AND tenant_id = $2`, [o.extId, tenantId]);
    if (empRes.rows.length === 0) {
      const username = `abeeso_${o.extId}`;
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

  const csvPath = process.argv[2] || "attached_assets/ABEESO_SECURITY_AND_CLEANING_SERVICES_LTD_1773277297550.csv";
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
    const payRate = parseFloat(parts[13].trim());

    const res = await pool.query(
      `INSERT INTO shifts (tenant_id, site_id, employee_id, supplier_id, title, date, start_time, end_time, break_minutes, status, external_id, supplier_approval_status, pay_rate, check_in_time, check_out_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'completed', $9, 'approved', $10, $11::timestamp, $12::timestamp)
       ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId, siteId, empId, supplierId, title, shiftDate, startTime, endTime, extId, payRate, checkIn, checkOut]
    );
    if (res.rowCount > 0) inserted++;
  }

  console.log(`Done: ${inserted} shifts inserted, all marked approved.`);
  await pool.end();
}

main().catch(console.error);
