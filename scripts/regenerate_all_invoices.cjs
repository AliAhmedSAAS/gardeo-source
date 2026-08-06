const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TENANT_ID = 7;
const ADMIN = 'cb99e7a7-de01-403d-8706-4a89cadee995';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== STEP 1: BACKUP EXISTING DATA ===');

    const existingInvoices = await client.query(`
      SELECT i.*, s.vat_status, s.company_name
      FROM invoices i
      JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.tenant_id = $1
      ORDER BY i.period_start, i.supplier_id
    `, [TENANT_ID]);
    console.log(`Backed up ${existingInvoices.rows.length} invoices`);

    const existingAllocations = await client.query(`
      SELECT ba.*, i.supplier_id, i.period_start::text as period_start, i.period_end::text as period_end
      FROM bank_transaction_allocations ba
      JOIN invoices i ON i.id = ba.invoice_id
      WHERE ba.tenant_id = $1
    `, [TENANT_ID]);
    console.log(`Backed up ${existingAllocations.rows.length} bank allocations`);

    const statusMap = {};
    const invoiceMeta = {};
    for (const inv of existingInvoices.rows) {
      const key = `${inv.supplier_id}_${inv.period_start.toISOString().substring(0, 7)}`;
      statusMap[key] = {
        status: inv.status,
        paid_at: inv.paid_at,
        paid_by: inv.paid_by,
        payment_date: inv.payment_date,
        issued_at: inv.issued_at,
        issued_by: inv.issued_by,
        accepted_at: inv.accepted_at,
        accepted_by_supplier_user_id: inv.accepted_by_supplier_user_id,
        generated_at: inv.generated_at,
      };
      invoiceMeta[key] = {
        old_id: inv.id,
        old_number: inv.invoice_number,
      };
    }

    const allocBackup = [];
    for (const alloc of existingAllocations.rows) {
      const key = `${alloc.supplier_id}_${alloc.period_start.substring(0, 7)}`;
      allocBackup.push({
        key,
        bank_transaction_id: alloc.bank_transaction_id,
        supplier_id: alloc.supplier_id,
        amount: alloc.amount,
        allocated_by: alloc.allocated_by,
        allocated_at: alloc.allocated_at,
        notes: alloc.notes,
        client_invoice_id: alloc.client_invoice_id,
      });
    }

    console.log('\n=== STEP 2: DELETE EXISTING INVOICES ===');

    const delLineItems = await client.query(`
      DELETE FROM invoice_line_items
      WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = $1)
    `, [TENANT_ID]);
    console.log(`Deleted ${delLineItems.rowCount} line items`);

    const delAllocations = await client.query(`
      DELETE FROM bank_transaction_allocations WHERE tenant_id = $1
    `, [TENANT_ID]);
    console.log(`Deleted ${delAllocations.rowCount} bank allocations`);

    const delInvoices = await client.query(`
      DELETE FROM invoices WHERE tenant_id = $1
    `, [TENANT_ID]);
    console.log(`Deleted ${delInvoices.rowCount} invoices`);

    console.log('\n=== STEP 3: LOAD RATE CARDS ===');

    const rateCards = await client.query(`
      SELECT supplier_id, hourly_rate, effective_from, effective_to
      FROM rate_cards WHERE tenant_id = $1
      ORDER BY supplier_id, effective_from
    `, [TENANT_ID]);

    const rateCardMap = {};
    for (const rc of rateCards.rows) {
      if (!rateCardMap[rc.supplier_id]) rateCardMap[rc.supplier_id] = [];
      rateCardMap[rc.supplier_id].push(rc);
    }
    console.log(`Loaded rate cards for ${Object.keys(rateCardMap).length} suppliers`);

    function getRateForShift(supplierId, shiftDate, shiftPayRate) {
      const cards = rateCardMap[supplierId];
      if (cards) {
        for (const rc of cards) {
          const from = new Date(rc.effective_from);
          const to = rc.effective_to ? new Date(rc.effective_to) : new Date('2099-12-31');
          if (shiftDate >= from && shiftDate <= to) {
            return parseFloat(rc.hourly_rate);
          }
        }
      }
      if (shiftPayRate && parseFloat(shiftPayRate) > 0) {
        return parseFloat(shiftPayRate);
      }
      return null;
    }

    console.log('\n=== STEP 4: GROUP SHIFTS BY SUPPLIER+MONTH ===');

    const shifts = await client.query(`
      SELECT s.id, s.supplier_id, s.date, s.start_time, s.end_time, s.break_minutes,
        s.pay_rate, s.title, s.external_id,
        sup.vat_status, sup.company_name
      FROM shifts s
      JOIN suppliers sup ON sup.id = s.supplier_id
      WHERE s.tenant_id = $1 AND s.status = 'completed' AND s.supplier_id IS NOT NULL
      ORDER BY s.date, s.supplier_id, s.id
    `, [TENANT_ID]);
    console.log(`Total completed shifts with supplier: ${shifts.rows.length}`);

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

    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
      return a.supplier_id - b.supplier_id;
    });

    console.log('\n=== STEP 5: GENERATE INVOICES ===');

    let globalSeq = 0;
    let totalInvoices = 0;
    let totalLineItems = 0;
    const newInvoiceMap = {};

    for (const group of sortedGroups) {
      globalSeq++;
      const year = group.year;
      const month = String(group.month).padStart(2, '0');
      const periodStart = `${year}-${month}-01`;
      const lastDay = new Date(year, group.month, 0).getDate();
      const periodEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      const invoiceNumber = `SBI-GUA-${year}${month}-${String(globalSeq).padStart(4, '0')}`;

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

      const lookupKey = `${group.supplier_id}_${year}-${month}`;
      const oldMeta = statusMap[lookupKey] || {};
      const status = oldMeta.status || 'approved';

      const generatedAt = oldMeta.generated_at || `${periodEnd}T12:00:00`;
      const issuedAt = oldMeta.issued_at || null;
      const issuedBy = oldMeta.issued_by || null;

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
        generatedAt, issuedAt, issuedBy, oldMeta.paid_at || null, oldMeta.paid_by || null, oldMeta.payment_date || null,
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

    console.log('\n=== STEP 6: RESTORE BANK ALLOCATIONS ===');

    let restoredAllocs = 0;
    let missingAllocs = 0;
    for (const alloc of allocBackup) {
      const newInv = newInvoiceMap[alloc.key];
      if (!newInv) {
        console.log(`  WARNING: No new invoice for allocation key ${alloc.key}`);
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

    console.log('\n=== STEP 7: VERIFICATION ===');

    const verifyInv = await client.query(`
      SELECT status, COUNT(*) as cnt, SUM(total_amount)::numeric(12,2) as total
      FROM invoices WHERE tenant_id = $1
      GROUP BY status ORDER BY status
    `, [TENANT_ID]);
    console.log('Invoice status summary:');
    verifyInv.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt} invoices, £${r.total}`));

    const verifySupp = await client.query(`
      SELECT i.supplier_id, s.company_name, s.vat_status, COUNT(*) as cnt,
        MIN(i.period_start)::text as min_p, MAX(i.period_end)::text as max_p,
        SUM(i.total_amount)::numeric(12,2) as total
      FROM invoices i JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.tenant_id = $1
      GROUP BY i.supplier_id, s.company_name, s.vat_status
      ORDER BY i.supplier_id
    `, [TENANT_ID]);
    console.log('\nInvoices per supplier:');
    verifySupp.rows.forEach(r => console.log(
      `  ID ${r.supplier_id} | ${r.company_name.substring(0,30)} | ${r.vat_status} | ${r.cnt} inv | £${r.total} | ${r.min_p} to ${r.max_p}`
    ));

    const verifyNum = await client.query(`
      SELECT MIN(invoice_number) as first_num, MAX(invoice_number) as last_num, COUNT(*) as cnt
      FROM invoices WHERE tenant_id = $1
    `, [TENANT_ID]);
    console.log(`\nInvoice numbers: ${verifyNum.rows[0].first_num} -> ${verifyNum.rows[0].last_num} (${verifyNum.rows[0].cnt} total)`);

    const verifyAlloc = await client.query(`
      SELECT COUNT(*) as cnt FROM bank_transaction_allocations WHERE tenant_id = $1
    `, [TENANT_ID]);
    console.log(`Bank allocations: ${verifyAlloc.rows[0].cnt}`);

    const verifyLi = await client.query(`
      SELECT COUNT(*) as cnt FROM invoice_line_items li
      JOIN invoices i ON i.id = li.invoice_id WHERE i.tenant_id = $1
    `, [TENANT_ID]);
    console.log(`Line items: ${verifyLi.rows[0].cnt}`);

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
