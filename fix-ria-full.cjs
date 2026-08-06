const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SUPPLIER_ID = 23;
const TENANT_ID = 7;
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoices = await client.query("SELECT id, invoice_number, TO_CHAR(period_start,'YYYY-MM') as month FROM invoices WHERE supplier_id=$1 ORDER BY period_start", [SUPPLIER_ID]);
    console.log('Existing invoices:', invoices.rows.map(r => r.invoice_number + ' (' + r.month + ')').join(', '));

    const csv = fs.readFileSync('attached_assets/RIA_1772825305835.csv', 'utf8');
    const lines = csv.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(l => { const v = parseCSVLine(l); const o = {}; headers.forEach((h, i) => o[h] = v[i] || ''); return o; });

    const csvMonths = new Set();
    for (const r of rows) csvMonths.add(r.shift_date.substring(0, 7));

    const extraInvoices = invoices.rows.filter(r => !csvMonths.has(r.month));
    const keepInvoices = invoices.rows.filter(r => csvMonths.has(r.month));
    console.log('Extra to drop:', extraInvoices.map(r => r.invoice_number).join(', ') || 'none');
    console.log('Keep:', keepInvoices.map(r => r.invoice_number).join(', ') || 'none');

    // Delete all line items
    for (const inv of invoices.rows) {
      await client.query("DELETE FROM invoice_line_items WHERE invoice_id=$1", [inv.id]);
    }

    // Delete extra invoices and their bank allocs
    for (const inv of extraInvoices) {
      const ba = await client.query("DELETE FROM bank_transaction_allocations WHERE invoice_id=$1 RETURNING id", [inv.id]);
      console.log('Dropped ' + ba.rowCount + ' bank allocs for ' + inv.invoice_number + ' (freed seq ' + inv.invoice_number.split('-')[3] + ')');
      await client.query("DELETE FROM invoices WHERE id=$1", [inv.id]);
      console.log('Dropped invoice ' + inv.invoice_number);
    }

    // Delete all shifts
    const delShifts = await client.query("DELETE FROM shifts WHERE supplier_id=$1 RETURNING id", [SUPPLIER_ID]);
    console.log('Deleted ' + delShifts.rowCount + ' shifts');

    // Re-import from CSV
    let imported = 0;
    for (const r of rows) {
      const st = r.duty_start ? r.duty_start.split(' ')[1].substring(0, 5) : '00:00';
      const et = r.duty_finish ? r.duty_finish.split(' ')[1].substring(0, 5) : '00:00';
      const rate = parseFloat(r.rate) || 12;
      await client.query(
        "INSERT INTO shifts (tenant_id, supplier_id, title, date, start_time, end_time, pay_rate, external_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [TENANT_ID, SUPPLIER_ID, r.officer_name, r.shift_date, st, et, rate, r.shift_id]
      );
      imported++;
    }
    console.log('Imported ' + imported + ' shifts');

    // Available sequences: Apr=0099, May=0109, Jun=0119
    const newInvoiceSeqs = { '2022-04': '0099', '2022-05': '0109', '2022-06': '0119' };
    const keptByMonth = {};
    for (const inv of keepInvoices) keptByMonth[inv.month] = inv;

    const csvMonthsSorted = [...csvMonths].sort();
    for (const ym of csvMonthsSorted) {
      const [y, m] = ym.split('-');
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const startDate = ym + '-01';
      const endDate = ym + '-' + lastDay;

      const shifts = await client.query(
        "SELECT id, date, start_time, end_time, pay_rate, title FROM shifts WHERE supplier_id=$1 AND date >= $2 AND date <= $3 ORDER BY date, start_time",
        [SUPPLIER_ID, startDate, endDate]
      );
      if (shifts.rowCount === 0) continue;

      let invId;
      if (keptByMonth[ym]) {
        invId = keptByMonth[ym].id;
        console.log('Recalculating ' + keptByMonth[ym].invoice_number + ' (' + ym + ')');
      } else {
        const seq = newInvoiceSeqs[ym];
        if (!seq) { console.log('No seq for ' + ym); continue; }
        const invNum = 'SBI-GUA-' + y + m + '-' + seq;
        const res = await client.query(
          "INSERT INTO invoices (tenant_id, supplier_id, invoice_number, invoice_type, status, period_start, period_end, due_date, total_hours, subtotal, vat_amount, total_amount) VALUES ($1,$2,$3,'self_billed','paid',$4,$5,$5,0,0,0,0) RETURNING id",
          [TENANT_ID, SUPPLIER_ID, invNum, startDate, endDate]
        );
        invId = res.rows[0].id;
        console.log('Created ' + invNum + ' (' + ym + ')');
      }

      let totalHours = 0, totalSub = 0;
      for (const s of shifts.rows) {
        const p1 = (s.start_time || '0:0').split(':').map(Number);
        const p2 = (s.end_time || '0:0').split(':').map(Number);
        let sm = p1[0] * 60 + p1[1], em = p2[0] * 60 + p2[1];
        if (em <= sm) em += 1440;
        const hrs = Math.round(((em - sm) / 60) * 100) / 100;
        const rate = parseFloat(s.pay_rate) || 12;
        const sub = Math.round(hrs * rate * 100) / 100;
        const vat = Math.round(sub * VAT_RATE * 100) / 100;
        totalHours += hrs;
        totalSub += sub;
        await client.query(
          "INSERT INTO invoice_line_items (invoice_id, shift_id, description, hours, rate, subtotal, vat_amount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [invId, s.id, (s.title || 'Shift') + ' (' + s.start_time + '-' + s.end_time + ')', hrs, rate, sub, vat]
        );
      }
      const invoiceSub = Math.round(totalSub * 100) / 100;
      const invoiceVat = Math.round(invoiceSub * VAT_RATE * 100) / 100;
      const invoiceTotal = Math.round((invoiceSub + invoiceVat) * 100) / 100;
      await client.query("UPDATE invoices SET total_hours=$1, subtotal=$2, vat_amount=$3, total_amount=$4 WHERE id=$5",
        [totalHours, invoiceSub, invoiceVat, invoiceTotal, invId]);
      console.log('  -> ' + shifts.rowCount + ' shifts, ' + totalHours.toFixed(2) + ' hrs, £' + invoiceTotal.toFixed(2));
    }

    await client.query('COMMIT');
    console.log('\nCOMMITTED');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR:', err.message);
  } finally {
    client.release();
  }

  // VERIFY
  const csv2 = fs.readFileSync('attached_assets/RIA_1772825305835.csv', 'utf8');
  const lines2 = csv2.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const headers2 = parseCSVLine(lines2[0]);
  const rows2 = lines2.slice(1).map(l => { const v = parseCSVLine(l); const o = {}; headers2.forEach((h, i) => o[h] = v[i] || ''); return o; });
  const csvByMonth = {};
  for (const r of rows2) {
    const ym = r.shift_date.substring(0, 7);
    if (!csvByMonth[ym]) csvByMonth[ym] = { shifts: 0, hours: 0 };
    csvByMonth[ym].shifts++;
    csvByMonth[ym].hours += parseFloat(r.hours) || 0;
  }

  const dbShifts = await pool.query("SELECT TO_CHAR(date,'YYYY-MM') as ym, start_time, end_time FROM shifts WHERE supplier_id=" + SUPPLIER_ID);
  const dbByMonth = {};
  for (const s of dbShifts.rows) {
    if (!dbByMonth[s.ym]) dbByMonth[s.ym] = { shifts: 0, hours: 0 };
    dbByMonth[s.ym].shifts++;
    const p1 = (s.start_time || '0:0').split(':').map(Number), p2 = (s.end_time || '0:0').split(':').map(Number);
    if (!isNaN(p1[0]) && !isNaN(p2[0])) {
      let sm = p1[0] * 60 + p1[1], em = p2[0] * 60 + p2[1];
      if (em <= sm) em += 1440;
      dbByMonth[s.ym].hours += (em - sm) / 60;
    }
  }

  const inv2 = await pool.query("SELECT invoice_number, TO_CHAR(period_start,'YYYY-MM') as month, total_hours, total_amount, status, (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id=i.id) as li_count, (SELECT COUNT(*) FROM bank_transaction_allocations WHERE invoice_id=i.id) as ba, (SELECT COALESCE(SUM(amount),0) FROM bank_transaction_allocations WHERE invoice_id=i.id) as ba_total FROM invoices i WHERE supplier_id=" + SUPPLIER_ID + " ORDER BY period_start");

  const allMonths = [...new Set([...Object.keys(csvByMonth), ...Object.keys(dbByMonth)])].sort();
  console.log('\n=== VERIFICATION ===');
  console.log('Month    | CSV Shifts | CSV Hours  | Sys Shifts | Sys Hours  | Inv Hours  | Shift Diff | Hours Diff');
  console.log('---------|------------|------------|------------|------------|------------|------------|----------');
  for (const ym of allMonths) {
    const c = csvByMonth[ym] || { shifts: 0, hours: 0 }, d = dbByMonth[ym] || { shifts: 0, hours: 0 };
    const invRow = inv2.rows.find(r => r.month === ym);
    const invHrs = invRow ? parseFloat(invRow.total_hours).toFixed(2) : 'N/A';
    const sd = d.shifts - c.shifts, hd = d.hours - c.hours;
    const m = sd === 0 && Math.abs(hd) < 1 ? ' ✓' : ' ⚠';
    console.log(ym.padEnd(9) + '| ' + String(c.shifts).padStart(10) + ' | ' + c.hours.toFixed(2).padStart(10) + ' | ' + String(d.shifts).padStart(10) + ' | ' + d.hours.toFixed(2).padStart(10) + ' | ' + String(invHrs).padStart(10) + ' | ' + (sd >= 0 ? '+' : '') + String(sd).padStart(9) + ' | ' + (hd >= 0 ? '+' : '') + hd.toFixed(2).padStart(9) + m);
  }

  console.log('\n=== INVOICES ===');
  for (const r of inv2.rows) {
    console.log(r.invoice_number + ' | ' + r.month + ' | hrs:' + parseFloat(r.total_hours).toFixed(2) + ' | £' + parseFloat(r.total_amount).toFixed(2) + ' | ' + r.status + ' | LIs:' + r.li_count + ' | Bank:' + r.ba + ' (£' + parseFloat(r.ba_total).toFixed(2) + ')');
  }

  pool.end();
})();
