const { Pool } = require('/home/runner/workspace/node_modules/pg');

const TENANT_ID = 7;
const ADMIN = 'cb99e7a7-de01-403d-8706-4a89cadee995';
const TARGET_SUPPLIERS = [14, 17, 26]; // Delta Force, Red Apple, RKFM
const DRY_RUN = false;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== TARGETED INVOICE REGENERATION ===');
    console.log('Suppliers:', TARGET_SUPPLIERS.join(', '));

    const suppInfo = await client.query(`
      SELECT id, company_name, vat_status FROM suppliers 
      WHERE id = ANY($1) AND tenant_id = $2
    `, [TARGET_SUPPLIERS, TENANT_ID]);
    suppInfo.rows.forEach(s => console.log(`  ${s.id}: ${s.company_name} (${s.vat_status})`));

    console.log('\n=== STEP 1: BACKUP BANK ALLOCATIONS ===');
    const allocs = await client.query(`
      SELECT bta.*, i.supplier_id as inv_supplier_id, to_char(i.period_start, 'YYYY-MM') as month_key
      FROM bank_transaction_allocations bta
      JOIN invoices i ON i.id = bta.invoice_id
      WHERE bta.tenant_id = $1 AND i.supplier_id = ANY($2)
    `, [TENANT_ID, TARGET_SUPPLIERS]);
    
    const allocBackup = allocs.rows.map(a => ({
      ...a,
      lookup_key: `${a.inv_supplier_id}_${a.month_key}`,
    }));
    console.log(`Backed up ${allocBackup.length} bank allocations`);

    console.log('\n=== STEP 2: GET EXISTING INVOICE METADATA ===');
    const existingInvoices = await client.query(`
      SELECT i.id, i.supplier_id, i.invoice_number, i.period_start, i.period_end,
        i.status, i.generated_at, i.issued_at, i.issued_by,
        i.paid_at, i.paid_by, i.payment_date,
        i.accepted_at, i.accepted_by_supplier_user_id,
        to_char(i.period_start, 'YYYY-MM') as month_key
      FROM invoices i
      WHERE i.tenant_id = $1 AND i.supplier_id = ANY($2)
      ORDER BY i.period_start, i.supplier_id
    `, [TENANT_ID, TARGET_SUPPLIERS]);
    
    const statusMap = {};
    const invoiceNumberMap = {};
    for (const inv of existingInvoices.rows) {
      const key = `${inv.supplier_id}_${inv.month_key}`;
      statusMap[key] = {
        status: inv.status,
        generated_at: inv.generated_at,
        issued_at: inv.issued_at,
        issued_by: inv.issued_by,
        paid_at: inv.paid_at,
        paid_by: inv.paid_by,
        payment_date: inv.payment_date,
        accepted_at: inv.accepted_at,
        accepted_by_supplier_user_id: inv.accepted_by_supplier_user_id,
      };
      invoiceNumberMap[key] = inv.invoice_number;
    }
    console.log(`Backed up metadata for ${existingInvoices.rows.length} existing invoices`);

    console.log('\n=== STEP 3: DELETE EXISTING INVOICES FOR TARGET SUPPLIERS ===');
    const existingIds = existingInvoices.rows.map(i => i.id);
    if (existingIds.length > 0) {
      await client.query(`DELETE FROM bank_transaction_allocations WHERE invoice_id = ANY($1)`, [existingIds]);
      await client.query(`DELETE FROM invoice_line_items WHERE invoice_id = ANY($1)`, [existingIds]);
      await client.query(`DELETE FROM invoices WHERE id = ANY($1)`, [existingIds]);
      console.log(`Deleted ${existingIds.length} invoices and their line items/allocations`);
    }

    console.log('\n=== STEP 4: LOAD RATE CARDS ===');
    const rateCards = await client.query(`
      SELECT supplier_id, hourly_rate, effective_from, effective_to
      FROM rate_cards WHERE tenant_id = $1 AND supplier_id = ANY($2)
      ORDER BY supplier_id, effective_from
    `, [TENANT_ID, TARGET_SUPPLIERS]);

    const rateCardMap = {};
    for (const rc of rateCards.rows) {
      if (!rateCardMap[rc.supplier_id]) rateCardMap[rc.supplier_id] = [];
      rateCardMap[rc.supplier_id].push(rc);
    }
    console.log('Rate cards loaded:');
    for (const [sid, cards] of Object.entries(rateCardMap)) {
      cards.forEach(c => console.log(`  Supplier ${sid}: £${c.hourly_rate} from ${c.effective_from.toISOString().substring(0,10)} to ${c.effective_to ? c.effective_to.toISOString().substring(0,10) : 'ongoing'}`));
    }

    function getRateForShift(supplierId, shiftDate, shiftPayRate) {
      const cards = rateCardMap[supplierId];
      if (cards) {
        let bestCard = null;
        for (const rc of cards) {
          const from = new Date(rc.effective_from);
          const to = rc.effective_to ? new Date(rc.effective_to) : new Date('2099-12-31');
          if (shiftDate >= from && shiftDate <= to) {
            if (!bestCard) {
              bestCard = rc;
            } else {
              const bestFrom = new Date(bestCard.effective_from);
              const bestTo = bestCard.effective_to ? new Date(bestCard.effective_to) : new Date('2099-12-31');
              const bestRange = bestTo - bestFrom;
              const thisRange = to - from;
              if (thisRange < bestRange) {
                bestCard = rc;
              }
            }
          }
        }
        if (bestCard) return parseFloat(bestCard.hourly_rate);
      }
      if (shiftPayRate && parseFloat(shiftPayRate) > 0) {
        return parseFloat(shiftPayRate);
      }
      return null;
    }

    console.log('\n=== STEP 5: LOAD AND GROUP SHIFTS ===');
    const shifts = await client.query(`
      SELECT s.id, s.supplier_id, s.date, s.start_time, s.end_time, s.break_minutes,
        s.pay_rate, s.title, s.external_id,
        sup.vat_status, sup.company_name
      FROM shifts s
      JOIN suppliers sup ON sup.id = s.supplier_id
      WHERE s.tenant_id = $1 AND s.status = 'completed' AND s.supplier_id = ANY($2)
      ORDER BY s.date, s.supplier_id, s.id
    `, [TENANT_ID, TARGET_SUPPLIERS]);
    console.log(`Total shifts for target suppliers: ${shifts.rows.length}`);

    const groups = {};
    let skippedNoRate = 0;
    for (const shift of shifts.rows) {
      const d = new Date(shift.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const groupKey = `${shift.supplier_id}_${monthKey}`;

      const rate = getRateForShift(shift.supplier_id, d, shift.pay_rate);
      if (!rate) {
        skippedNoRate++;
        continue;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          supplier_id: shift.supplier_id,
          company_name: shift.company_name,
          vat_status: shift.vat_status,
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          monthKey,
          shifts: [],
        };
      }
      groups[groupKey].shifts.push({ ...shift, resolved_rate: rate });
    }
    console.log(`Created ${Object.keys(groups).length} invoice groups`);
    if (skippedNoRate > 0) console.log(`Skipped ${skippedNoRate} shifts with no rate`);

    console.log('\n=== STEP 6: GENERATE INVOICES (PRESERVING INVOICE NUMBERS) ===');

    let totalInvoices = 0;
    let totalLineItems = 0;
    const newInvoiceMap = {};

    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
      return a.supplier_id - b.supplier_id;
    });

    for (const group of sortedGroups) {
      const year = group.year;
      const month = String(group.month).padStart(2, '0');
      const periodStart = `${year}-${month}-01`;
      const lastDay = new Date(year, group.month, 0).getDate();
      const periodEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const lookupKey = `${group.supplier_id}_${year}-${month}`;
      const invoiceNumber = invoiceNumberMap[lookupKey];
      if (!invoiceNumber) {
        console.log(`  WARNING: No existing invoice number for ${lookupKey}, skipping`);
        continue;
      }

      const isVat = group.vat_status === 'vat_registered';
      const vatRate = isVat ? 20.00 : 0.00;

      let totalHours = 0;
      let subtotal = 0;
      const lineItems = [];

      for (const shift of group.shifts) {
        const d = new Date(shift.date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;

        let hours = 0;
        if (shift.start_time && shift.end_time) {
          const [sh, sm] = shift.start_time.split(':').map(Number);
          const [eh, em] = shift.end_time.split(':').map(Number);
          if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
            let startMins = sh * 60 + sm;
            let endMins = eh * 60 + em;
            if (endMins <= startMins) endMins += 24 * 60;
            hours = (endMins - startMins - (shift.break_minutes || 0)) / 60;
          }
        }
        if (isNaN(hours) || hours < 0) hours = 0;
        hours = Math.round(hours * 100) / 100;

        const rate = shift.resolved_rate;
        const lineSubtotal = Math.round(hours * rate * 100) / 100;
        const lineVat = isVat ? Math.round(lineSubtotal * 0.20 * 100) / 100 : 0;
        const lineTotal = Math.round((lineSubtotal + lineVat) * 100) / 100;

        totalHours += hours;
        subtotal += lineSubtotal;

        lineItems.push({
          shift_id: shift.id,
          description: `${dateStr} — Security Duty @ £${rate.toFixed(2)}/hr`,
          hours,
          rate,
          subtotal: lineSubtotal,
          vat_rate: vatRate,
          vat_amount: lineVat,
          line_total: lineTotal,
        });
      }

      totalHours = Math.round(totalHours * 100) / 100;
      subtotal = Math.round(subtotal * 100) / 100;
      if (isNaN(subtotal)) subtotal = 0;
      if (isNaN(totalHours)) totalHours = 0;
      const vatAmount = isVat ? Math.round(subtotal * 0.20 * 100) / 100 : 0;
      const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
      const avgRate = totalHours > 0 ? Math.round((subtotal / totalHours) * 100) / 100 : 0;

      const oldMeta = statusMap[lookupKey] || {};
      const status = oldMeta.status || 'approved';
      const generatedAt = oldMeta.generated_at || `${periodEnd}T12:00:00`;

      const result = await client.query(`
        INSERT INTO invoices (
          tenant_id, supplier_id, invoice_number, period_start, period_end,
          total_hours, hourly_rate, subtotal, vat_rate, vat_amount, total_amount,
          status, invoice_type, approved_timesheet_count, billing_period,
          generated_at, issued_at, issued_by, paid_at, paid_by, payment_date,
          accepted_at, accepted_by_supplier_user_id,
          created_by, created_at, updated_at, due_date
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, 'self_billed', $13, $14,
          $15, $16, $17, $18, $19, $20,
          $21, $22,
          $23, NOW(), NOW(), NULL
        ) RETURNING id
      `, [
        TENANT_ID, group.supplier_id, invoiceNumber, periodStart, periodEnd,
        totalHours, avgRate, subtotal, vatRate, vatAmount, totalAmount,
        status, group.shifts.length, `${periodStart} to ${periodEnd}`,
        generatedAt, oldMeta.issued_at || null, oldMeta.issued_by || null,
        oldMeta.paid_at || null, oldMeta.paid_by || null, oldMeta.payment_date || null,
        oldMeta.accepted_at || null, oldMeta.accepted_by_supplier_user_id || null,
        ADMIN,
      ]);

      const newInvoiceId = result.rows[0].id;
      newInvoiceMap[lookupKey] = { id: newInvoiceId, invoice_number: invoiceNumber };
      totalInvoices++;

      for (const li of lineItems) {
        await client.query(`
          INSERT INTO invoice_line_items (
            invoice_id, shift_id, description, hours, rate, subtotal,
            vat_rate, vat_amount, line_total, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          newInvoiceId, li.shift_id, li.description, li.hours, li.rate, li.subtotal,
          li.vat_rate, li.vat_amount, li.line_total,
        ]);
        totalLineItems++;
      }
    }

    console.log(`Generated ${totalInvoices} invoices with ${totalLineItems} line items`);

    console.log('\n=== STEP 7: RESTORE BANK ALLOCATIONS ===');
    let restoredAllocs = 0;
    let missingAllocs = 0;
    for (const alloc of allocBackup) {
      const newInv = newInvoiceMap[alloc.lookup_key];
      if (!newInv) {
        console.log(`  WARNING: No new invoice for allocation key ${alloc.lookup_key}`);
        missingAllocs++;
        continue;
      }

      await client.query(`
        INSERT INTO bank_transaction_allocations (
          tenant_id, bank_transaction_id, invoice_id, supplier_id, amount,
          allocated_by, allocated_at, notes, client_invoice_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        TENANT_ID, alloc.bank_transaction_id, newInv.id, alloc.supplier_id, alloc.amount,
        alloc.allocated_by, alloc.allocated_at, alloc.notes, alloc.client_invoice_id,
      ]);
      restoredAllocs++;
    }
    console.log(`Restored ${restoredAllocs} bank allocations (${missingAllocs} missing)`);

    console.log('\n=== STEP 8: VERIFICATION ===');
    for (const sid of TARGET_SUPPLIERS) {
      const v = await client.query(`
        SELECT s.company_name, COUNT(*) as cnt, 
          SUM(i.subtotal)::numeric(12,2) as total_sub,
          SUM(i.total_amount)::numeric(12,2) as total_amt,
          MIN(i.period_start)::text as min_p, MAX(i.period_end)::text as max_p
        FROM invoices i JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.tenant_id = $1 AND i.supplier_id = $2
        GROUP BY s.company_name
      `, [TENANT_ID, sid]);
      if (v.rows[0]) {
        console.log(`  ${v.rows[0].company_name}: ${v.rows[0].cnt} invoices, subtotal £${v.rows[0].total_sub}, total £${v.rows[0].total_amt}`);
      }
    }

    const totalAllInv = await client.query(`SELECT COUNT(*) as cnt, SUM(total_amount)::numeric(14,2) as total FROM invoices WHERE tenant_id = $1`, [TENANT_ID]);
    console.log(`\nTotal all invoices: ${totalAllInv.rows[0].cnt}, £${totalAllInv.rows[0].total}`);

    const totalAllocs = await client.query(`SELECT COUNT(*) as cnt FROM bank_transaction_allocations WHERE tenant_id = $1`, [TENANT_ID]);
    console.log(`Total bank allocations: ${totalAllocs.rows[0].cnt}`);

    if (DRY_RUN) {
      console.log('\n*** DRY RUN — ROLLING BACK ***');
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      console.log('\n*** COMMITTED ***');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR — ROLLED BACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
