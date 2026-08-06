const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPPLIER_ID = 18;

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
      console.log(`CSV: ${csvMonth.length} rows, ${csvTotalHrs.toFixed(2)} hrs, £${csvTotalAmt.toFixed(2)} amount`);

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
      const unmatched = [];

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
          } else {
            unmatched.push(csv);
          }
        }
      }

      console.log(`Matched: ${matched.length}, Unmatched: ${unmatched.length}`);

      let updated = 0;
      for (const { csv, sys } of matched) {
        const res = await pool.query(
          'UPDATE invoice_line_items SET charge_rate = $1, charge_amount = $2 WHERE invoice_id = $3 AND shift_id = $4',
          [csv.rate, csv.amount, m.invId, sys.shift_id]
        );
        if (res.rowCount > 0) updated++;
      }
      console.log(`Updated charge_rate/charge_amount on ${updated} line items`);

      const verifyRes = await pool.query(`
        SELECT COUNT(*) as cnt,
          SUM(hours)::numeric(10,2) as hrs,
          SUM(subtotal)::numeric(10,2) as net,
          SUM(charge_amount)::numeric(10,2) as charge_total,
          SUM(line_total)::numeric(10,2) as gross
        FROM invoice_line_items WHERE invoice_id = $1
      `, [m.invId]);
      const v = verifyRes.rows[0];
      const invRes = await pool.query('SELECT total_amount FROM invoices WHERE id = $1', [m.invId]);

      console.log(`\nInvoice ${m.label} after sync:`);
      console.log(`  Line items: ${v.cnt}`);
      console.log(`  Hours: ${v.hrs}`);
      console.log(`  Net (pay): £${v.net}`);
      console.log(`  Charge total (from CSV): £${v.charge_total}`);
      console.log(`  CSV Amount total: £${csvTotalAmt.toFixed(2)}`);
      console.log(`  Invoice total_amount: £${invRes.rows[0].total_amount}`);
      const diff = (parseFloat(v.charge_total) - csvTotalAmt).toFixed(2);
      console.log(`  Charge vs CSV diff: £${diff}`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
  await pool.end();
})();
