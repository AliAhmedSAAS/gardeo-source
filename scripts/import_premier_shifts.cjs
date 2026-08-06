const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tenantId = 7;
  const supplierId = 39;
  const payRate = 11.5;

  console.log("=== Premier Resources Ltd shift import ===");
  console.log("Supplier ID: 39, External ID: 4579");
  console.log("51 shifts, Feb-Mar 2022, rate: £11.50/hr");

  const siteRes = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, postcode, external_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING RETURNING id`,
    [tenantId, "1 94 Providence Place Maidenhead SL6 8BF", "1 94 Providence Place, Maidenhead SL6 8BF", "SL6 8BF", "premier_maidenhead"]
  );
  const siteId = siteRes.rows.length > 0
    ? siteRes.rows[0].id
    : (await pool.query(`SELECT id FROM sites WHERE external_id = 'premier_maidenhead' AND tenant_id = $1`, [tenantId])).rows[0].id;
  console.log(`Site ID: ${siteId}`);

  const officers = [
    { name: "MATTHEW BUCHANAN", extId: "16350" },
    { name: "SARDAR YASIN", extId: "16248" },
    { name: "EMMANUEL OGUNSOLA", extId: "17754" },
  ];

  const empMap = {};
  for (const o of officers) {
    const parts = o.name.split(" ");
    const username = `premier_${o.extId}`;
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
    } else {
      await pool.query(`UPDATE employees SET supplier_id = $1 WHERE id = $2`, [supplierId, empRes.rows[0].id]);
    }
    empMap[o.extId] = empRes.rows[0].id;
    console.log(`Employee ${o.name} (ext ${o.extId}): ID ${empMap[o.extId]}`);
  }

  const shifts = [
    { extId: "386247", empExt: "16350", date: "2022-02-01", start: "06:00", end: "19:37" },
    { extId: "386250", empExt: "16350", date: "2022-02-04", start: "06:00", end: "18:00" },
    { extId: "386277", empExt: "16248", date: "2022-02-04", start: "06:00", end: "18:00" },
    { extId: "386251", empExt: "16350", date: "2022-02-05", start: "06:00", end: "18:00" },
    { extId: "386253", empExt: "16350", date: "2022-02-07", start: "06:00", end: "19:00" },
    { extId: "386282", empExt: "16248", date: "2022-02-09", start: "06:00", end: "18:00" },
    { extId: "386283", empExt: "16248", date: "2022-02-10", start: "06:00", end: "18:00" },
    { extId: "386257", empExt: "16350", date: "2022-02-11", start: "06:00", end: "18:00" },
    { extId: "386284", empExt: "16248", date: "2022-02-11", start: "06:00", end: "18:00" },
    { extId: "386258", empExt: "16350", date: "2022-02-12", start: "06:00", end: "18:00" },
    { extId: "386285", empExt: "16248", date: "2022-02-12", start: "06:00", end: "18:00" },
    { extId: "386286", empExt: "16248", date: "2022-02-13", start: "06:00", end: "18:00" },
    { extId: "386260", empExt: "16350", date: "2022-02-14", start: "06:00", end: "18:00" },
    { extId: "386287", empExt: "16248", date: "2022-02-14", start: "06:00", end: "18:00" },
    { extId: "386261", empExt: "16350", date: "2022-02-15", start: "06:00", end: "18:00" },
    { extId: "386262", empExt: "16350", date: "2022-02-16", start: "06:00", end: "21:10" },
    { extId: "386289", empExt: "16248", date: "2022-02-16", start: "06:00", end: "18:00" },
    { extId: "386290", empExt: "16248", date: "2022-02-17", start: "06:00", end: "18:00" },
    { extId: "386264", empExt: "16350", date: "2022-02-18", start: "06:00", end: "18:00" },
    { extId: "386291", empExt: "16248", date: "2022-02-18", start: "06:00", end: "18:00" },
    { extId: "386265", empExt: "16350", date: "2022-02-19", start: "06:00", end: "18:00" },
    { extId: "386293", empExt: "16248", date: "2022-02-20", start: "06:00", end: "18:00" },
    { extId: "386267", empExt: "16350", date: "2022-02-21", start: "06:00", end: "18:00" },
    { extId: "386294", empExt: "16248", date: "2022-02-21", start: "06:00", end: "18:00" },
    { extId: "386268", empExt: "16350", date: "2022-02-22", start: "06:00", end: "18:00" },
    { extId: "386269", empExt: "16350", date: "2022-02-23", start: "06:00", end: "18:00" },
    { extId: "386296", empExt: "16248", date: "2022-02-23", start: "06:00", end: "18:00" },
    { extId: "386270", empExt: "16350", date: "2022-02-24", start: "06:00", end: "18:00" },
    { extId: "386271", empExt: "16350", date: "2022-02-25", start: "06:00", end: "18:00" },
    { extId: "386298", empExt: "16248", date: "2022-02-25", start: "06:00", end: "19:00" },
    { extId: "386273", empExt: "16350", date: "2022-02-27", start: "06:00", end: "18:00" },
    { extId: "386300", empExt: "16248", date: "2022-02-27", start: "06:00", end: "18:00" },
    { extId: "386303", empExt: "16248", date: "2022-03-03", start: "06:00", end: "18:00" },
    { extId: "386305", empExt: "16248", date: "2022-03-05", start: "06:00", end: "18:00" },
    { extId: "386306", empExt: "16248", date: "2022-03-06", start: "06:00", end: "18:00" },
    { extId: "386309", empExt: "16248", date: "2022-03-09", start: "06:00", end: "18:00" },
    { extId: "386311", empExt: "16248", date: "2022-03-11", start: "06:00", end: "18:00" },
    { extId: "386312", empExt: "16248", date: "2022-03-12", start: "06:00", end: "18:00" },
    { extId: "386314", empExt: "16248", date: "2022-03-14", start: "06:00", end: "18:00" },
    { extId: "386344", empExt: "17754", date: "2022-03-14", start: "06:00", end: "18:18" },
    { extId: "386315", empExt: "16248", date: "2022-03-15", start: "06:00", end: "18:00" },
    { extId: "386318", empExt: "16248", date: "2022-03-18", start: "06:00", end: "18:00" },
    { extId: "386319", empExt: "16248", date: "2022-03-19", start: "06:00", end: "18:00" },
    { extId: "386351", empExt: "17754", date: "2022-03-21", start: "06:00", end: "18:00" },
    { extId: "386322", empExt: "16248", date: "2022-03-22", start: "06:00", end: "18:00" },
    { extId: "386353", empExt: "17754", date: "2022-03-23", start: "06:00", end: "18:00" },
    { extId: "386354", empExt: "17754", date: "2022-03-24", start: "06:00", end: "18:00" },
    { extId: "386355", empExt: "17754", date: "2022-03-25", start: "06:00", end: "19:00" },
    { extId: "386326", empExt: "16248", date: "2022-03-26", start: "06:00", end: "18:00" },
    { extId: "386328", empExt: "16248", date: "2022-03-28", start: "06:00", end: "18:00" },
    { extId: "386359", empExt: "17754", date: "2022-03-29", start: "06:00", end: "18:00" },
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
      [tenantId, siteId, empId, supplierId, "1 94 Providence Place Maidenhead", s.date, s.start, s.end, s.extId, payRate, checkIn, checkOut]
    );
    if (res.rowCount > 0) inserted++;
  }

  console.log(`Done: ${inserted} shifts inserted, all marked approved at £${payRate}/hr.`);
  await pool.end();
}

main().catch(console.error);
