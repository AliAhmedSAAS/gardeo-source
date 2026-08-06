const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TENANT_ID = 7;
const ADMIN_USER_ID = 'cb99e7a7-de01-403d-8706-4a89cadee995';

const SUPPLIER_MAP = {
  '1116': 36,
  '1118': 46,
  '4550': 38,
};

const CSV_FILE = process.env.CSV_FILE || '/home/runner/workspace/attached_assets/timesheet_nonVAt_2021_01_01_to_2021_12_31_1772762594704.csv';

async function main() {
  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const header = lines[0];
  const dataLines = lines.slice(1);
  console.log(`Total CSV rows: ${dataLines.length}`);

  const existingRes = await pool.query(
    `SELECT external_id FROM shifts WHERE tenant_id = $1 AND supplier_id IN (36, 38, 46) AND external_id IS NOT NULL`,
    [TENANT_ID]
  );
  const existingExtIds = new Set(existingRes.rows.map(r => r.external_id));
  console.log(`Existing shifts with external_id for these suppliers: ${existingExtIds.size}`);

  let inserted = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  const supplierStats = {};

  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 15) { skippedInvalid++; continue; }

    const csvShiftId = parts[0].trim();
    const csvSupplierId = parts[3].trim();
    const shiftDate = parts[5].trim();
    const dutyStart = parts[6].trim();
    const dutyFinish = parts[7].trim();
    const hours = parseFloat(parts[12].trim()) || 0;
    const rate = parseFloat(parts[13].trim()) || 0;

    const dbSupplierId = SUPPLIER_MAP[csvSupplierId];
    if (!dbSupplierId) { skippedInvalid++; continue; }

    if (existingExtIds.has(csvShiftId)) {
      skippedDuplicate++;
      continue;
    }

    const startTime = dutyStart.length >= 16 ? dutyStart.substring(11, 16) : dutyStart.substring(0, 5);
    const endTime = dutyFinish.length >= 16 ? dutyFinish.substring(11, 16) : dutyFinish.substring(0, 5);

    await pool.query(
      `INSERT INTO shifts (tenant_id, supplier_id, date, start_time, end_time, break_minutes, status, title,
        supplier_approval_status, supplier_approved_at, external_id, pay_rate, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, 'completed', 'Security Duty',
        'approved', $6::timestamp, $7, $8, $9, $6::timestamp)`,
      [
        TENANT_ID,
        dbSupplierId,
        shiftDate,
        startTime,
        endTime,
        shiftDate + 'T12:00:00',
        csvShiftId,
        rate,
        ADMIN_USER_ID,
      ]
    );

    inserted++;
    existingExtIds.add(csvShiftId);

    const key = `${dbSupplierId}`;
    if (!supplierStats[key]) supplierStats[key] = { name: parts[4].trim(), count: 0 };
    supplierStats[key].count++;
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicate): ${skippedDuplicate}`);
  console.log(`Skipped (invalid): ${skippedInvalid}`);
  console.log(`\nPer supplier:`);
  for (const [id, stat] of Object.entries(supplierStats)) {
    console.log(`  Supplier ${id} (${stat.name}): ${stat.count} shifts`);
  }

  const verifyRes = await pool.query(
    `SELECT supplier_id, s2.company_name, COUNT(*) as cnt,
      MIN(date)::text as min_date, MAX(date)::text as max_date
     FROM shifts s
     JOIN suppliers s2 ON s2.id = s.supplier_id
     WHERE s.tenant_id = $1 AND s.supplier_id IN (36, 38, 46)
     GROUP BY supplier_id, s2.company_name
     ORDER BY supplier_id`,
    [TENANT_ID]
  );
  console.log(`\nVerification - total shifts in DB for these suppliers:`);
  verifyRes.rows.forEach(r => {
    console.log(`  ${r.company_name} (ID ${r.supplier_id}): ${r.cnt} shifts (${r.min_date} to ${r.max_date})`);
  });

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
