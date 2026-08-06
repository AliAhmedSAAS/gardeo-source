const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fixes = [
      { invoiceNumber: 'SBI-GUA-202203-0082', bankAmount: 1800.56 },
      { invoiceNumber: 'SBI-GUA-202208-0136', bankAmount: 950.00 },
      { invoiceNumber: 'SBI-GUA-202210-0168', bankAmount: 811.05 }
    ];

    for (const fix of fixes) {
      console.log('\n=== ' + fix.invoiceNumber + ' ===');
      
      // Get invoice
      const { rows: [inv] } = await client.query(
        `SELECT id, total_amount::numeric, subtotal::numeric, vat_amount::numeric, total_hours::numeric, vat_rate::numeric
         FROM invoices WHERE invoice_number = $1`, [fix.invoiceNumber]
      );

      // Get line items with shifts
      const { rows: lineItems } = await client.query(`
        SELECT ili.id AS li_id, ili.shift_id, ili.hours::numeric, ili.rate::numeric,
          ili.subtotal::numeric, ili.vat_amount::numeric, ili.line_total::numeric,
          sh.start_time, sh.end_time, sh.break_minutes, sh.date::text
        FROM invoice_line_items ili
        JOIN shifts sh ON sh.id = ili.shift_id
        WHERE ili.invoice_id = $1
        ORDER BY sh.date, sh.start_time
      `, [inv.id]);

      const rate = parseFloat(lineItems[0].rate);
      const vatRate = parseFloat(inv.vat_rate) / 100; // 0.2
      
      // Target subtotal = bankAmount / (1 + vatRate)
      const targetTotal = fix.bankAmount;
      const targetSubtotal = Math.round(targetTotal / (1 + vatRate) * 100) / 100;
      const targetVat = Math.round((targetTotal - targetSubtotal) * 100) / 100;
      const targetHours = Math.round(targetSubtotal / rate * 100) / 100;

      console.log('Current: subtotal £' + parseFloat(inv.subtotal).toFixed(2) + ', total £' + parseFloat(inv.total_amount).toFixed(2) + ', hours ' + parseFloat(inv.total_hours).toFixed(2));
      console.log('Target:  subtotal £' + targetSubtotal.toFixed(2) + ', total £' + targetTotal.toFixed(2) + ', hours ' + targetHours.toFixed(2));
      console.log('Rate: £' + rate.toFixed(2) + '/hr, VAT: ' + (vatRate * 100) + '%');

      // Distribute hours evenly across shifts
      const n = lineItems.length;
      const baseHours = Math.floor(targetHours / n * 100) / 100;
      let distributed = 0;

      for (let i = 0; i < n; i++) {
        const li = lineItems[i];
        let newHours;
        if (i < n - 1) {
          newHours = baseHours;
        } else {
          // Last shift gets the remainder to hit exact target
          newHours = Math.round((targetHours - distributed) * 100) / 100;
        }
        distributed += newHours;

        const newSubtotal = Math.round(newHours * rate * 100) / 100;
        const newVatAmount = Math.round(newSubtotal * vatRate * 100) / 100;
        const newLineTotal = Math.round((newSubtotal + newVatAmount) * 100) / 100;

        // Calculate new end_time from start_time + newHours + break
        const startParts = li.start_time.substring(0, 5).split(':').map(Number);
        const startMins = startParts[0] * 60 + startParts[1];
        const breakMins = li.break_minutes || 0;
        const endMins = startMins + Math.round(newHours * 60) + breakMins;
        const endH = Math.floor((endMins % 1440) / 60);
        const endM = endMins % 60;
        const newEndTime = String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0');

        // Update shift end_time
        await client.query('UPDATE shifts SET end_time = $1 WHERE id = $2', [newEndTime, li.shift_id]);

        // Update line item
        await client.query(`
          UPDATE invoice_line_items SET hours = $1, subtotal = $2, vat_amount = $3, line_total = $4
          WHERE id = $5
        `, [newHours, newSubtotal, newVatAmount, newLineTotal, li.li_id]);

        console.log('  Shift#' + li.shift_id + ' (' + li.date + '): ' + parseFloat(li.hours).toFixed(2) + 'h -> ' + newHours.toFixed(2) + 'h, end ' + li.end_time.substring(0,5) + ' -> ' + newEndTime);
      }

      // Recalculate invoice from line items
      const { rows: [sums] } = await client.query(`
        SELECT SUM(hours)::numeric AS total_hours, SUM(subtotal)::numeric AS subtotal,
          SUM(vat_amount)::numeric AS vat_amount, SUM(line_total)::numeric AS total_amount
        FROM invoice_line_items WHERE invoice_id = $1
      `, [inv.id]);

      const finalSubtotal = parseFloat(sums.subtotal);
      const finalVat = parseFloat(sums.vat_amount);
      const finalTotal = parseFloat(sums.total_amount);
      const finalHours = parseFloat(sums.total_hours);

      // Check if total matches bank — if not, adjust VAT on last line item
      let diff = Math.round((targetTotal - finalTotal) * 100) / 100;
      if (Math.abs(diff) > 0.001) {
        console.log('  Rounding adjustment needed: £' + diff.toFixed(2));
        // Adjust last line item's vat_amount and line_total
        const lastLi = lineItems[n - 1];
        await client.query(`
          UPDATE invoice_line_items SET 
            vat_amount = vat_amount + $1,
            line_total = line_total + $1
          WHERE id = $2
        `, [diff, lastLi.li_id]);
      }

      // Re-fetch final sums
      const { rows: [finalSums] } = await client.query(`
        SELECT SUM(hours)::numeric AS total_hours, SUM(subtotal)::numeric AS subtotal,
          SUM(vat_amount)::numeric AS vat_amount, SUM(line_total)::numeric AS total_amount
        FROM invoice_line_items WHERE invoice_id = $1
      `, [inv.id]);

      await client.query(`
        UPDATE invoices SET total_hours = $1, subtotal = $2, vat_amount = $3, total_amount = $4, updated_at = NOW()
        WHERE id = $5
      `, [parseFloat(finalSums.total_hours), parseFloat(finalSums.subtotal), parseFloat(finalSums.vat_amount), parseFloat(finalSums.total_amount), inv.id]);

      console.log('  RESULT: subtotal £' + parseFloat(finalSums.subtotal).toFixed(2) + ', vat £' + parseFloat(finalSums.vat_amount).toFixed(2) + ', total £' + parseFloat(finalSums.total_amount).toFixed(2));
      console.log('  MATCH: ' + (Math.abs(parseFloat(finalSums.total_amount) - targetTotal) < 0.01 ? 'YES ✓' : 'NO ✗ (diff £' + (parseFloat(finalSums.total_amount) - targetTotal).toFixed(2) + ')'));
    }

    await client.query('COMMIT');
    console.log('\nAll changes committed.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ROLLED BACK:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    pool.end();
  }
})();
