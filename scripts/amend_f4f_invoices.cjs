const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPPLIER_ID = 18;
const VAT_RATE = 20.00;

(async () => {
  try {
    const rateRes = await pool.query('SELECT site_id, hourly_rate FROM rate_cards WHERE supplier_id = $1', [SUPPLIER_ID]);
    const siteRates = {};
    let defaultRate = 11.50;
    for (const r of rateRes.rows) {
      if (r.site_id) siteRates[r.site_id] = parseFloat(r.hourly_rate);
      else defaultRate = parseFloat(r.hourly_rate);
    }

    function getRate(siteId) {
      return siteRates[siteId] || defaultRate;
    }

    function calcHours(st, et) {
      const [sh, sm] = st.split(':').map(Number);
      const [eh, em] = et.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins <= 0) mins += 1440;
      return Math.round(mins / 60 * 100) / 100;
    }

    function formatDate(d) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dt = new Date(d);
      return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    }

    const invoices = [
      { id: 189, number: 'SBI-GUA-202105-0008', start: '2021-05-01', end: '2021-05-31' },
      { id: 193, number: 'SBI-GUA-202106-0012', start: '2021-06-01', end: '2021-06-30' },
      { id: 197, number: 'SBI-GUA-202107-0016', start: '2021-07-01', end: '2021-07-31' },
    ];

    for (const inv of invoices) {
      console.log(`\n=== ${inv.number} (${inv.start} to ${inv.end}) ===`);

      const shiftsRes = await pool.query(`
        SELECT sh.id as shift_id, sh.date::text as shift_date, sh.site_id,
          CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END AS st,
          CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END AS et,
          sh.title,
          COALESCE(si.name, sh.title) as site_name
        FROM shifts sh
        LEFT JOIN sites si ON sh.site_id = si.id
        WHERE sh.supplier_id = $1
        AND sh.date::date >= $2 AND sh.date::date <= $3
        ORDER BY sh.date
      `, [SUPPLIER_ID, inv.start, inv.end]);

      const existingRes = await pool.query(
        'SELECT id, shift_id, hours, rate, subtotal FROM invoice_line_items WHERE invoice_id = $1', [inv.id]
      );
      const existingByShift = {};
      for (const li of existingRes.rows) {
        existingByShift[li.shift_id] = li;
      }

      let updated = 0, added = 0, totalHours = 0, totalSubtotal = 0;

      for (const sh of shiftsRes.rows) {
        const hours = calcHours(sh.st, sh.et);
        const rate = getRate(sh.site_id);
        const subtotal = Math.round(hours * rate * 100) / 100;
        const vatAmount = Math.round(subtotal * VAT_RATE) / 100;
        const lineTotal = Math.round((subtotal + vatAmount) * 100) / 100;
        const desc = `${formatDate(sh.shift_date)} — ${sh.site_name} @ £${rate.toFixed(2)}/hr`;

        totalHours += hours;
        totalSubtotal += subtotal;

        const existing = existingByShift[sh.shift_id];
        if (existing) {
          const existHrs = parseFloat(existing.hours);
          const existRate = parseFloat(existing.rate);
          if (Math.abs(existHrs - hours) > 0.01 || Math.abs(existRate - rate) > 0.01) {
            await pool.query(`
              UPDATE invoice_line_items
              SET hours = $1, rate = $2, subtotal = $3, description = $4,
                  vat_rate = $5, vat_amount = $6, line_total = $7
              WHERE id = $8
            `, [hours, rate, subtotal, desc, VAT_RATE, vatAmount, lineTotal, existing.id]);
            updated++;
          }
          delete existingByShift[sh.shift_id];
        } else {
          await pool.query(`
            INSERT INTO invoice_line_items (invoice_id, shift_id, description, hours, rate, subtotal, vat_rate, vat_amount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [inv.id, sh.shift_id, desc, hours, rate, subtotal, VAT_RATE, vatAmount, lineTotal]);
          added++;
        }
      }

      const orphanIds = Object.values(existingByShift).map(li => li.id);
      if (orphanIds.length > 0) {
        await pool.query('DELETE FROM invoice_line_items WHERE id = ANY($1)', [orphanIds]);
        console.log(`Removed ${orphanIds.length} orphan line items (shifts no longer exist)`);
      }

      const totalVat = Math.round(totalSubtotal * VAT_RATE) / 100;
      const totalAmount = Math.round((totalSubtotal + totalVat) * 100) / 100;

      await pool.query(`
        UPDATE invoices SET total_hours = $1, total_amount = $2 WHERE id = $3
      `, [totalHours, totalAmount, inv.id]);

      console.log(`Shifts: ${shiftsRes.rows.length}`);
      console.log(`Line items: updated=${updated}, added=${added}, orphans removed=${orphanIds.length}`);
      console.log(`Invoice totals: ${totalHours.toFixed(2)} hours, £${totalSubtotal.toFixed(2)} net, £${totalAmount.toFixed(2)} inc VAT`);
    }

    console.log('\n=== VERIFICATION ===');
    for (const inv of invoices) {
      const res = await pool.query(`
        SELECT i.invoice_number, i.total_hours, i.total_amount,
          (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id) as lines,
          (SELECT SUM(hours)::numeric(10,2) FROM invoice_line_items WHERE invoice_id = i.id) as li_hours,
          (SELECT SUM(subtotal)::numeric(10,2) FROM invoice_line_items WHERE invoice_id = i.id) as li_subtotal,
          (SELECT SUM(line_total)::numeric(10,2) FROM invoice_line_items WHERE invoice_id = i.id) as li_total
        FROM invoices i WHERE i.id = $1
      `, [inv.id]);
      const r = res.rows[0];
      console.log(`${r.invoice_number}: ${r.lines} items, ${r.li_hours}h, net £${r.li_subtotal}, total £${r.li_total}, inv_total £${r.total_amount}`);
    }

  } catch (err) {
    console.error('Error:', err);
  }
  await pool.end();
})();
