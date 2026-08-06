const { Pool } = require('/home/runner/workspace/node_modules/pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const F4F_SUPPLIER_ID = 18;
const TENANT_ID = 7;

async function run() {
  const csvPath = path.join(__dirname, '..', 'attached_assets', 'F4F Shifts - Shifts.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at', csvPath);
    process.exit(1);
  }

  const csvData = fs.readFileSync(csvPath, 'utf8');
  const lines = csvData.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());

  const dateIdx = headers.indexOf('Date');
  const startIdx = headers.indexOf('Start');
  const endIdx = headers.indexOf('End');
  const rateIdx = headers.indexOf('Rate');

  if (rateIdx === -1) {
    console.error('No Rate column found in CSV. Headers:', headers);
    process.exit(1);
  }

  console.log(`CSV has ${lines.length - 1} data rows`);
  console.log(`Rate column index: ${rateIdx}`);

  let updated = 0;
  let notFound = 0;
  let noRate = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rawDate = cols[dateIdx];
    const rawStart = cols[startIdx];
    const rawEnd = cols[endIdx];
    const rawRate = cols[rateIdx];

    if (!rawDate || !rawStart || !rawEnd) continue;

    const rate = parseFloat(rawRate);
    if (isNaN(rate) || rate <= 0) {
      noRate++;
      continue;
    }

    const parts = rawDate.split('/');
    const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    const startTime = rawStart.length === 4 ? '0' + rawStart : rawStart;
    const endTime = rawEnd.length === 4 ? '0' + rawEnd : rawEnd;

    const result = await pool.query(
      `UPDATE shifts SET pay_rate = $1
       WHERE tenant_id = $2 AND supplier_id = $3 AND date = $4
         AND (LEFT(CASE WHEN start_time LIKE '____-__-__ %' THEN SUBSTRING(start_time FROM 12 FOR 5) ELSE LEFT(start_time, 5) END, 5) = $5)
         AND (LEFT(CASE WHEN end_time LIKE '____-__-__ %' THEN SUBSTRING(end_time FROM 12 FOR 5) ELSE LEFT(end_time, 5) END, 5) = $6)
         AND pay_rate IS NULL`,
      [rate, TENANT_ID, F4F_SUPPLIER_ID, isoDate, startTime, endTime]
    );

    if (result.rowCount > 0) {
      updated += result.rowCount;
    } else {
      notFound++;
    }

    if (i % 1000 === 0) console.log(`Processed ${i}/${lines.length - 1} rows, updated ${updated} shifts...`);
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Updated: ${updated} shifts`);
  console.log(`  Not found/already set: ${notFound}`);
  console.log(`  No rate in CSV: ${noRate}`);

  await pool.query(
    `UPDATE suppliers SET rate_type = 'per_shift' WHERE id = $1 AND tenant_id = $2`,
    [F4F_SUPPLIER_ID, TENANT_ID]
  );
  console.log(`\nSet F4F (supplier_id=${F4F_SUPPLIER_ID}) rate_type to 'per_shift'`);

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM shifts WHERE supplier_id = $1 AND tenant_id = $2 AND pay_rate IS NOT NULL`,
    [F4F_SUPPLIER_ID, TENANT_ID]
  );
  console.log(`Total F4F shifts with pay_rate set: ${count}`);

  const { rows: [{ count: nullCount }] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM shifts WHERE supplier_id = $1 AND tenant_id = $2 AND pay_rate IS NULL`,
    [F4F_SUPPLIER_ID, TENANT_ID]
  );
  console.log(`Total F4F shifts with pay_rate NULL: ${nullCount}`);

  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
