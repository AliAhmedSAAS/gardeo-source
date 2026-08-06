const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SUPPLIER_ID = 34;
const VAT_RATE = 0.20;

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += line[i]; }
  }
  result.push(current.trim());
  return result;
}

(async () => {
  const csv = fs.readFileSync('attached_assets/Alliance_Facility_1772824381510.csv', 'utf8');
  const lines = csv.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = parseCSVLine(l);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });

  const csvApr = rows.filter(r => r.shift_date.startsWith('2022-04'));
  console.log('CSV Apr 2022 shifts:', csvApr.length);

  const dbApr = await pool.query(
    "SELECT id, date, start_time, end_time, pay_rate, title, external_id FROM shifts WHERE supplier_id = $1 AND date >= '2022-04-01' AND date <= '2022-04-30' ORDER BY date, start_time",
    [SUPPLIER_ID]
  );
  console.log('DB Apr 2022 shifts:', dbApr.rows.length);

  // Match by external_id
  const dbByExtId = {};
  for (const r of dbApr.rows) {
    if (r.external_id) dbByExtId[r.external_id] = r;
  }

  const updates = [];
  const matchedDbIds = new Set();

  for (const csvRow of csvApr) {
    const dbMatch = dbByExtId[csvRow.shift_id];
    if (!dbMatch) continue;
    matchedDbIds.add(dbMatch.id);

    const csvSt = csvRow.duty_start ? csvRow.duty_start.split(' ')[1].substring(0,5) : '';
    const csvEt = csvRow.duty_finish ? csvRow.duty_finish.split(' ')[1].substring(0,5) : '';
    const csvRate = parseFloat(csvRow.rate) || 11;

    if (dbMatch.start_time !== csvSt || dbMatch.end_time !== csvEt || parseFloat(dbMatch.pay_rate) !== csvRate) {
      const d = dbMatch.date instanceof Date ? dbMatch.date.toISOString().substring(0,10) : String(dbMatch.date);
      console.log("  FIX: shift " + dbMatch.id + " (ext:" + csvRow.shift_id + ") " + d + " | DB: " + dbMatch.start_time + "-" + dbMatch.end_time + " -> CSV: " + csvSt + "-" + csvEt);
      updates.push({ id: dbMatch.id, startTime: csvSt, endTime: csvEt, rate: csvRate });
    }
  }

  // Unmatched shifts
  const unmatchedCsv = csvApr.filter(r => !dbByExtId[r.shift_id]);
  const dbNoMatch = dbApr.rows.filter(r => !matchedDbIds.has(r.id));
  console.log('\nUnmatched CSV (no ext_id match):', unmatchedCsv.length);
  console.log('Unmatched DB:', dbNoMatch.length);

  // Match remaining by date + closest time
  const usedDbIds = new Set();
  for (const csvRow of unmatchedCsv) {
    const csvDate = csvRow.shift_date;
    const csvSt = csvRow.duty_start ? csvRow.duty_start.split(' ')[1].substring(0,5) : '';
    const csvEt = csvRow.duty_finish ? csvRow.duty_finish.split(' ')[1].substring(0,5) : '';
    const csvRate = parseFloat(csvRow.rate) || 11;

    const candidates = dbNoMatch.filter(r => {
      const d = r.date instanceof Date ? r.date.toISOString().substring(0,10) : String(r.date);
      return d === csvDate && !usedDbIds.has(r.id);
    });

    if (candidates.length > 0) {
      let best = candidates[0];
      for (const c of candidates) {
        if (c.start_time === csvSt && c.end_time === csvEt) { best = c; break; }
      }
      usedDbIds.add(best.id);
      if (best.start_time !== csvSt || best.end_time !== csvEt || parseFloat(best.pay_rate) !== csvRate) {
        const d = best.date instanceof Date ? best.date.toISOString().substring(0,10) : String(best.date);
        console.log("  FIX (no ext): shift " + best.id + " " + d + " | DB: " + best.start_time + "-" + best.end_time + " -> CSV: " + csvSt + "-" + csvEt);
        updates.push({ id: best.id, startTime: csvSt, endTime: csvEt, rate: csvRate });
      }
    }
  }

  console.log('\nTotal updates:', updates.length);

  if (updates.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const u of updates) {
        await client.query("UPDATE shifts SET start_time = $1, end_time = $2, pay_rate = $3 WHERE id = $4",
          [u.startTime, u.endTime, u.rate, u.id]);
      }

      // Recalculate invoice
      const inv = await client.query("SELECT id FROM invoices WHERE supplier_id = $1 AND TO_CHAR(period_start, 'YYYY-MM') = '2022-04'", [SUPPLIER_ID]);
      if (inv.rows.length > 0) {
        const invId = inv.rows[0].id;
        await client.query("DELETE FROM invoice_line_items WHERE invoice_id = $1", [invId]);

        const shifts = await client.query(
          "SELECT id, date, start_time, end_time, pay_rate, title FROM shifts WHERE supplier_id = $1 AND date >= '2022-04-01' AND date <= '2022-04-30' ORDER BY date, start_time",
          [SUPPLIER_ID]
        );

        let totalHours = 0, totalSub = 0;
        for (const s of shifts.rows) {
          const parts1 = (s.start_time||'0:0').split(':').map(Number);
          const parts2 = (s.end_time||'0:0').split(':').map(Number);
          let startMins = parts1[0]*60+parts1[1], endMins = parts2[0]*60+parts2[1];
          if (endMins <= startMins) endMins += 24*60;
          const hrs = Math.round(((endMins-startMins)/60)*100)/100;
          const rate = parseFloat(s.pay_rate)||11;
          const sub = Math.round(hrs*rate*100)/100;
          const vat = Math.round(sub*VAT_RATE*100)/100;
          totalHours += hrs;
          totalSub += sub;
          await client.query(
            "INSERT INTO invoice_line_items (invoice_id, shift_id, description, hours, rate, subtotal, vat_amount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            [invId, s.id, (s.title||'Shift')+' ('+s.start_time+'-'+s.end_time+')', hrs, rate, sub, vat]
          );
        }
        const invoiceSub = Math.round(totalSub*100)/100;
        const invoiceVat = Math.round(invoiceSub*VAT_RATE*100)/100;
        const invoiceTotal = Math.round((invoiceSub+invoiceVat)*100)/100;
        await client.query("UPDATE invoices SET total_hours=$1, subtotal=$2, vat_amount=$3, total_amount=$4 WHERE id=$5",
          [totalHours, invoiceSub, invoiceVat, invoiceTotal, invId]);
        console.log('Invoice updated: ' + totalHours.toFixed(2) + ' hrs, £' + invoiceTotal.toFixed(2));
      }

      await client.query('COMMIT');
      console.log('DONE');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('ERROR:', err.message);
    } finally {
      client.release();
    }
  }

  // Verify
  const dbCheck = await pool.query(
    "SELECT start_time, end_time FROM shifts WHERE supplier_id = $1 AND date >= '2022-04-01' AND date <= '2022-04-30'",
    [SUPPLIER_ID]
  );
  let sysH = 0;
  for (const s of dbCheck.rows) {
    const p1 = (s.start_time||'0:0').split(':').map(Number);
    const p2 = (s.end_time||'0:0').split(':').map(Number);
    if (isNaN(p1[0])||isNaN(p2[0])) continue;
    let sm = p1[0]*60+p1[1], em = p2[0]*60+p2[1];
    if (em <= sm) em += 1440;
    sysH += (em-sm)/60;
  }
  const csvH = csvApr.reduce((a,r) => a+(parseFloat(r.hours)||0), 0);
  console.log('\nVerify Apr 2022: CSV=' + csvH.toFixed(2) + ' Sys=' + sysH.toFixed(2) + ' Diff=' + (sysH-csvH).toFixed(2));

  pool.end();
})();
