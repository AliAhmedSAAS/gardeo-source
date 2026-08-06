const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPPLIER_ID = 18;
const VAT_RATE = 20.00;

function parseCsvLine(line) {
  const parts = []; let inQ = false, cur = '';
  for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur); return parts;
}
function normalize(name) { return name.toUpperCase().replace(/[^A-Z ]/g, '').trim(); }
function lastNameMatch(a, b) {
  const aP = normalize(a).split(/\s+/), bP = normalize(b).split(/\s+/);
  const aL = aP[aP.length-1], bL = bP[bP.length-1];
  return aL === bL || bP.includes(aL) || aP.includes(bL);
}
function padTime(t) { const p = t.split(':'); return p[0].padStart(2,'0') + ':' + p[1].padStart(2,'0'); }
function siteMatch(csvLoc, sysName) {
  const a = csvLoc.toUpperCase(), b = sysName.toUpperCase();
  if (a.includes(b) || b.includes(a)) return true;
  const aW = a.split(/\s+/).filter(w => w.length > 3), bW = b.split(/\s+/).filter(w => w.length > 3);
  return aW.filter(w => bW.includes(w)).length >= 2;
}

(async () => {
  try {
    const raw = fs.readFileSync('/home/runner/workspace/attached_assets/F4F--_05.04.21_to_31.03.23_1772675491655.csv', 'utf8');
    const lines = raw.trim().split('\n').slice(1);
    const csvShifts = lines.map(line => {
      const p = parseCsvLine(line);
      const [dd,mm,yyyy] = p[0].split('/');
      return { date: yyyy+'-'+mm+'-'+dd, location: p[1], officer: p[3], start: padTime(p[4]), finish: padTime(p[5]), hours: parseFloat(p[6]), rate: parseFloat(p[7]), amount: parseFloat(p[8]) };
    });

    const months = [
      { start: '2021-05-01', end: '2021-05-31', prefix: '2021-05', label: 'May 2021', invId: 189 },
      { start: '2021-06-01', end: '2021-06-30', prefix: '2021-06', label: 'Jun 2021', invId: 193 },
      { start: '2021-07-01', end: '2021-07-31', prefix: '2021-07', label: 'Jul 2021', invId: 197 },
    ];

    for (const m of months) {
      console.log(`\n=== ${m.label} ===`);

      const csvMonth = csvShifts.filter(c => c.date.startsWith(m.prefix));
      const csvTotalAmt = csvMonth.reduce((s,c) => s + c.amount, 0);
      const csvTotalHrs = csvMonth.reduce((s,c) => s + c.hours, 0);
      console.log(`CSV: ${csvMonth.length} rows, ${csvTotalHrs.toFixed(2)} hrs, £${csvTotalAmt.toFixed(2)} net`);

      const sysRes = await pool.query(`
        SELECT sh.id as shift_id, sh.date::text as shift_date,
          CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END AS st,
          CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END AS et,
          COALESCE(UPPER(u.first_name || ' ' || u.last_name), 'UNASSIGNED') as emp_name,
          COALESCE(si.name, sh.title, 'Unknown') as site_name
        FROM shifts sh
        LEFT JOIN sites si ON sh.site_id = si.id
        LEFT JOIN employees e ON sh.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE sh.supplier_id = $1 AND sh.date::date >= $2 AND sh.date::date <= $3
        ORDER BY sh.date
      `, [SUPPLIER_ID, m.start, m.end]);

      const usedIds = new Set();
      const matched = [];

      for (const csv of csvMonth) {
        const cands = sysRes.rows.filter(s =>
          s.shift_date === csv.date && s.st === csv.start && !usedIds.has(s.shift_id) && lastNameMatch(csv.officer, s.emp_name)
        );
        if (cands.length > 0) {
          const best = cands.reduce((a, b) => (b.et === csv.finish ? b : a));
          usedIds.add(best.shift_id);
          matched.push({ csv, sys: best });
        } else {
          const cands2 = sysRes.rows.filter(s =>
            s.shift_date === csv.date && s.st === csv.start && !usedIds.has(s.shift_id) && siteMatch(csv.location, s.site_name)
          );
          if (cands2.length > 0) {
            usedIds.add(cands2[0].shift_id);
            matched.push({ csv, sys: cands2[0] });
          }
        }
      }

      console.log(`Matched: ${matched.length}/${csvMonth.length}`);

      let updated = 0;
      for (const { csv, sys } of matched) {
        const subtotal = csv.amount;
        const vatAmount = Math.round(subtotal * VAT_RATE) / 100;
        const lineTotal = Math.round((subtotal + vatAmount) * 100) / 100;
        const desc = `${csv.date} — ${csv.location} @ £${csv.rate.toFixed(2)}/hr`;

        const res = await pool.query(`
          UPDATE invoice_line_items
          SET rate = $1, hours = $2, subtotal = $3, vat_amount = $4, line_total = $5, vat_rate = $6,
              charge_rate = $1, charge_amount = $3
          WHERE invoice_id = $7 AND shift_id = $8
        `, [csv.rate, csv.hours, subtotal, vatAmount, lineTotal, VAT_RATE, m.invId, sys.shift_id]);
        if (res.rowCount > 0) updated++;
      }
      console.log(`Updated ${updated} line items`);

      const sumRes = await pool.query(`
        SELECT SUM(hours)::numeric(10,2) as total_hrs,
               SUM(subtotal)::numeric(10,2) as total_net,
               SUM(vat_amount)::numeric(10,2) as total_vat,
               SUM(line_total)::numeric(10,2) as total_gross
        FROM invoice_line_items WHERE invoice_id = $1
      `, [m.invId]);
      const s = sumRes.rows[0];

      await pool.query('UPDATE invoices SET total_hours = $1, total_amount = $2 WHERE id = $3',
        [parseFloat(s.total_hrs), parseFloat(s.total_gross), m.invId]);

      console.log(`\nInvoice updated:`);
      console.log(`  Hours: ${s.total_hrs}`);
      console.log(`  Net: £${s.total_net}`);
      console.log(`  VAT: £${s.total_vat}`);
      console.log(`  Total (gross): £${s.total_gross}`);
      console.log(`  CSV net: £${csvTotalAmt.toFixed(2)}`);
      console.log(`  Net diff: £${(parseFloat(s.total_net) - csvTotalAmt).toFixed(2)}`);

      const rateBreak = await pool.query(`
        SELECT rate, COUNT(*) as shifts, SUM(hours)::numeric(10,2) as hrs, SUM(subtotal)::numeric(10,2) as amt
        FROM invoice_line_items WHERE invoice_id = $1
        GROUP BY rate ORDER BY rate
      `, [m.invId]);
      console.log(`\n  Rate Breakdown:`);
      for (const rb of rateBreak.rows) {
        console.log(`    ${rb.shifts} shifts @ £${parseFloat(rb.rate).toFixed(2)}/hr — ${rb.hrs} hrs = £${rb.amt}`);
      }

      const csvRateBreak = {};
      for (const csv of csvMonth) {
        const key = csv.rate.toFixed(2);
        if (!csvRateBreak[key]) csvRateBreak[key] = { shifts: 0, hrs: 0, amt: 0 };
        csvRateBreak[key].shifts++;
        csvRateBreak[key].hrs += csv.hours;
        csvRateBreak[key].amt += csv.amount;
      }
      console.log(`  CSV Rate Breakdown:`);
      for (const [rate, rb] of Object.entries(csvRateBreak).sort()) {
        console.log(`    ${rb.shifts} shifts @ £${rate}/hr — ${rb.hrs.toFixed(2)} hrs = £${rb.amt.toFixed(2)}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
  await pool.end();
})();
