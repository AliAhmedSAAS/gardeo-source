const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = 7;
  const supplierId = 50;
  const adminId = "cb99e7a7-de01-403d-8706-4a89cadee995";
  const payRate = 12;

  console.log("=== Zain Security Services Ltd shift import ===");
  console.log("Supplier ID: 50, External ID: 4594");
  console.log("60 shifts, April 2022, rate: £12/hr");

  const siteRes = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, postcode, external_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING RETURNING id`,
    [tenantId, "113 OCDDE1 Redditch 5 Kingfisher Walk Shopping Centre", "5 Kingfisher Walk Shopping Centre, Redditch", "B97 4EY", "1758"]
  );
  const siteId = siteRes.rows.length > 0
    ? siteRes.rows[0].id
    : (await pool.query(`SELECT id FROM sites WHERE external_id = '1758' AND tenant_id = $1`, [tenantId])).rows[0].id;
  console.log(`Site ID: ${siteId}`);

  const officers = [
    { name: "A ISHAQUE", extId: "11019" },
    { name: "A KHAN", extId: "11025" },
    { name: "A RAMJAN", extId: "11029" },
  ];

  const empMap = {};
  for (const o of officers) {
    const parts = o.name.split(" ");
    const username = `zain_${o.extId}`;
    const email = `${username}@placeholder.local`;

    let userRes = await pool.query(`SELECT id FROM users WHERE username = $1 AND tenant_id = $2`, [username, tenantId]);
    if (userRes.rows.length === 0) {
      userRes = await pool.query(
        `INSERT INTO users (id, username, email, password, first_name, last_name, role, tenant_id)
         VALUES (gen_random_uuid(), $1, $2, 'not_set', $3, $4, 'employee', $5)
         RETURNING id`,
        [username, email, parts[0], parts.slice(1).join(" "), tenantId]
      );
    }
    const userId = userRes.rows[0].id;

    let empRes = await pool.query(`SELECT id FROM employees WHERE external_id = $1 AND tenant_id = $2`, [o.extId, tenantId]);
    if (empRes.rows.length === 0) {
      empRes = await pool.query(
        `INSERT INTO employees (user_id, tenant_id, supplier_id, external_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, tenantId, supplierId, o.extId]
      );
    }
    empMap[o.extId] = empRes.rows[0].id;
    console.log(`Employee ${o.name} (ext ${o.extId}): ID ${empMap[o.extId]}`);
  }

  const shifts = [
    { extId: "386738", empExt: "11025", date: "2022-04-01", start: "06:00", end: "18:00" },
    { extId: "386767", empExt: "11029", date: "2022-04-01", start: "06:00", end: "19:00" },
    { extId: "386739", empExt: "11025", date: "2022-04-02", start: "06:00", end: "18:00" },
    { extId: "386711", empExt: "11019", date: "2022-04-03", start: "06:00", end: "18:00" },
    { extId: "386740", empExt: "11025", date: "2022-04-03", start: "06:00", end: "18:00" },
    { extId: "386769", empExt: "11029", date: "2022-04-03", start: "06:00", end: "18:00" },
    { extId: "386712", empExt: "11019", date: "2022-04-04", start: "06:00", end: "18:00" },
    { extId: "386770", empExt: "11029", date: "2022-04-04", start: "06:00", end: "18:00" },
    { extId: "386713", empExt: "11019", date: "2022-04-05", start: "06:00", end: "18:00" },
    { extId: "386714", empExt: "11019", date: "2022-04-06", start: "06:00", end: "18:00" },
    { extId: "386743", empExt: "11025", date: "2022-04-06", start: "06:00", end: "18:00" },
    { extId: "386772", empExt: "11029", date: "2022-04-06", start: "06:00", end: "18:00" },
    { extId: "386715", empExt: "11019", date: "2022-04-07", start: "06:00", end: "18:00" },
    { extId: "386773", empExt: "11029", date: "2022-04-07", start: "06:00", end: "18:00" },
    { extId: "386716", empExt: "11019", date: "2022-04-08", start: "06:00", end: "18:00" },
    { extId: "386774", empExt: "11029", date: "2022-04-08", start: "06:00", end: "18:00" },
    { extId: "386717", empExt: "11019", date: "2022-04-09", start: "06:00", end: "18:00" },
    { extId: "386746", empExt: "11025", date: "2022-04-09", start: "06:00", end: "18:00" },
    { extId: "386775", empExt: "11029", date: "2022-04-09", start: "06:00", end: "18:00" },
    { extId: "386718", empExt: "11019", date: "2022-04-10", start: "06:00", end: "18:00" },
    { extId: "386776", empExt: "11029", date: "2022-04-10", start: "06:00", end: "18:00" },
    { extId: "386748", empExt: "11025", date: "2022-04-11", start: "06:00", end: "18:00" },
    { extId: "386777", empExt: "11029", date: "2022-04-11", start: "06:00", end: "18:00" },
    { extId: "386778", empExt: "11029", date: "2022-04-12", start: "06:00", end: "18:00" },
    { extId: "386721", empExt: "11019", date: "2022-04-13", start: "06:00", end: "18:00" },
    { extId: "386750", empExt: "11025", date: "2022-04-13", start: "06:00", end: "18:00" },
    { extId: "386722", empExt: "11019", date: "2022-04-14", start: "06:00", end: "18:00" },
    { extId: "386751", empExt: "11025", date: "2022-04-14", start: "06:00", end: "18:00" },
    { extId: "386780", empExt: "11029", date: "2022-04-14", start: "06:00", end: "18:00" },
    { extId: "386781", empExt: "11029", date: "2022-04-15", start: "06:00", end: "18:00" },
    { extId: "386724", empExt: "11019", date: "2022-04-16", start: "06:00", end: "18:00" },
    { extId: "386782", empExt: "11029", date: "2022-04-16", start: "06:00", end: "18:00" },
    { extId: "386725", empExt: "11019", date: "2022-04-17", start: "06:00", end: "18:00" },
    { extId: "386754", empExt: "11025", date: "2022-04-17", start: "06:00", end: "18:00" },
    { extId: "386783", empExt: "11029", date: "2022-04-17", start: "06:00", end: "18:00" },
    { extId: "386726", empExt: "11019", date: "2022-04-18", start: "06:00", end: "18:00" },
    { extId: "386755", empExt: "11025", date: "2022-04-18", start: "06:00", end: "18:00" },
    { extId: "386727", empExt: "11019", date: "2022-04-19", start: "06:00", end: "18:00" },
    { extId: "386756", empExt: "11025", date: "2022-04-19", start: "06:00", end: "18:00" },
    { extId: "386728", empExt: "11019", date: "2022-04-20", start: "06:00", end: "18:00" },
    { extId: "386786", empExt: "11029", date: "2022-04-20", start: "06:00", end: "18:00" },
    { extId: "386729", empExt: "11019", date: "2022-04-21", start: "06:00", end: "18:00" },
    { extId: "386730", empExt: "11019", date: "2022-04-22", start: "06:00", end: "19:00" },
    { extId: "386732", empExt: "11019", date: "2022-04-24", start: "06:00", end: "18:00" },
    { extId: "386761", empExt: "11025", date: "2022-04-24", start: "06:00", end: "18:00" },
    { extId: "386790", empExt: "11029", date: "2022-04-24", start: "06:00", end: "18:00" },
    { extId: "386733", empExt: "11019", date: "2022-04-25", start: "06:00", end: "18:00" },
    { extId: "386762", empExt: "11025", date: "2022-04-25", start: "06:00", end: "18:00" },
    { extId: "386791", empExt: "11029", date: "2022-04-25", start: "06:00", end: "18:00" },
    { extId: "386734", empExt: "11019", date: "2022-04-26", start: "06:00", end: "18:00" },
    { extId: "386763", empExt: "11025", date: "2022-04-26", start: "06:00", end: "18:00" },
    { extId: "386792", empExt: "11029", date: "2022-04-26", start: "06:00", end: "18:00" },
    { extId: "386735", empExt: "11019", date: "2022-04-27", start: "06:00", end: "18:00" },
    { extId: "386764", empExt: "11025", date: "2022-04-27", start: "06:00", end: "18:00" },
    { extId: "386793", empExt: "11029", date: "2022-04-27", start: "06:00", end: "18:00" },
    { extId: "386736", empExt: "11019", date: "2022-04-28", start: "06:00", end: "18:00" },
    { extId: "386765", empExt: "11025", date: "2022-04-28", start: "06:00", end: "18:00" },
    { extId: "386794", empExt: "11029", date: "2022-04-28", start: "06:00", end: "18:00" },
    { extId: "386737", empExt: "11019", date: "2022-04-29", start: "06:00", end: "18:00" },
    { extId: "386795", empExt: "11029", date: "2022-04-29", start: "06:00", end: "20:55" },
  ];

  console.log(`\nImporting ${shifts.length} shifts...`);

  let inserted = 0;
  for (const s of shifts) {
    const empId = empMap[s.empExt];
    const checkIn = `${s.date} ${s.start}`;
    const checkOut = `${s.date} ${s.end}`;

    const res = await pool.query(
      `INSERT INTO shifts (tenant_id, site_id, employee_id, supplier_id, title, date, start_time, end_time, break_minutes, status, external_id, supplier_approval_status, pay_rate, check_in_time, check_out_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'completed', $9, 'approved', $10, $11::timestamp, $12::timestamp)
       ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId, siteId, empId, supplierId, "113 OCDDE1 Redditch Kingfisher Walk", s.date, s.start, s.end, s.extId, payRate, checkIn, checkOut]
    );
    if (res.rowCount > 0) inserted++;
  }

  console.log(`Done: ${inserted} shifts inserted, all marked approved at £${payRate}/hr.`);
  await pool.end();
}

main().catch(console.error);
