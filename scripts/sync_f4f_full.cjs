const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPPLIER_ID = 18;
const TENANT_ID = 7;
const DRY_RUN = process.argv.includes('--dry-run');

function parseCsvLine(line) {
  const parts = [];
  let inQ = false, cur = '';
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function normalize(name) {
  return name.toUpperCase().replace(/[^A-Z ]/g, '').trim();
}

function lastNameMatch(a, b) {
  const aParts = normalize(a).split(/\s+/);
  const bParts = normalize(b).split(/\s+/);
  const aLast = aParts[aParts.length - 1];
  const bLast = bParts[bParts.length - 1];
  if (aLast === bLast) return true;
  if (bParts.some(p => p === aLast)) return true;
  if (aParts.some(p => p === bLast)) return true;
  return false;
}

function siteMatch(csvLocation, sysName) {
  const csvUp = csvLocation.toUpperCase();
  const sysUp = sysName.toUpperCase();
  if (csvUp.includes(sysUp) || sysUp.includes(csvUp)) return true;
  const csvWords = csvUp.split(/\s+/).filter(w => w.length > 3);
  const sysWords = sysUp.split(/\s+/).filter(w => w.length > 3);
  const common = csvWords.filter(w => sysWords.includes(w));
  return common.length >= 2;
}

function padTime(t) {
  const parts = t.split(':');
  return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
}

(async () => {
  try {
    const raw = fs.readFileSync('/home/runner/workspace/attached_assets/F4F--_05.04.21_to_31.03.23_1772674428999.csv', 'utf8');
    const lines = raw.trim().split('\n').slice(1);

    const csvShifts = lines.map((line, idx) => {
      const parts = parseCsvLine(line);
      const [dd, mm, yyyy] = parts[0].split('/');
      return {
        idx,
        date: `${yyyy}-${mm}-${dd}`,
        location: parts[1],
        customer: parts[2],
        officer: parts[3],
        start: padTime(parts[4]),
        finish: padTime(parts[5]),
        hours: parseFloat(parts[6]),
        rate: parseFloat(parts[7]),
        amount: parseFloat(parts[8]),
      };
    });

    console.log('CSV rows:', csvShifts.length);

    const sysRes = await pool.query(`
      SELECT sh.id, sh.date::text as shift_date,
        CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END AS start_time,
        CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END AS end_time,
        sh.break_minutes, sh.title, sh.employee_id, sh.site_id,
        COALESCE(UPPER(u.first_name || ' ' || u.last_name), 'UNASSIGNED') as employee_name,
        COALESCE(si.name, 'Unknown') as site_name
      FROM shifts sh
      LEFT JOIN sites si ON sh.site_id = si.id
      LEFT JOIN employees e ON sh.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE sh.supplier_id = $1
      AND sh.date::date >= '2021-04-01' AND sh.date::date <= '2023-03-31'
      ORDER BY sh.date ASC
    `, [SUPPLIER_ID]);

    const sysShifts = sysRes.rows;
    console.log('System shifts:', sysShifts.length);

    const usedSysIds = new Set();
    const matched = [];
    const unmatchedCsv = [];

    // Pass 1: date + start + last name
    for (const csv of csvShifts) {
      const cands = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        !usedSysIds.has(s.id) &&
        lastNameMatch(csv.officer, s.employee_name)
      );
      if (cands.length > 0) {
        const best = cands.reduce((a, b) => {
          const aEnd = a.end_time === csv.finish ? 1 : 0;
          const bEnd = b.end_time === csv.finish ? 1 : 0;
          return bEnd > aEnd ? b : a;
        });
        usedSysIds.add(best.id);
        matched.push({ csv, sys: best });
      } else {
        unmatchedCsv.push(csv);
      }
    }
    console.log(`Pass 1: matched=${matched.length}, unmatched=${unmatchedCsv.length}`);

    // Pass 2: date + start + site
    const still2 = [];
    for (const csv of unmatchedCsv) {
      const cands = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        !usedSysIds.has(s.id) &&
        siteMatch(csv.location, s.site_name || s.title)
      );
      if (cands.length > 0) {
        usedSysIds.add(cands[0].id);
        matched.push({ csv, sys: cands[0] });
      } else {
        still2.push(csv);
      }
    }
    console.log(`Pass 2: matched=${matched.length}, unmatched=${still2.length}`);

    // Pass 3: date + start + finish (exact times match)
    const still3 = [];
    for (const csv of still2) {
      const cands = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        s.end_time === csv.finish &&
        !usedSysIds.has(s.id)
      );
      if (cands.length > 0) {
        usedSysIds.add(cands[0].id);
        matched.push({ csv, sys: cands[0] });
      } else {
        still3.push(csv);
      }
    }
    console.log(`Pass 3: matched=${matched.length}, unmatched=${still3.length}`);

    // Identify unmatched system shifts (to delete)
    const unmatchedSys = sysShifts.filter(s => !usedSysIds.has(s.id));

    // Identify end-time updates needed
    const toUpdate = matched.filter(m => m.sys.end_time !== m.csv.finish);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total CSV rows: ${csvShifts.length}`);
    console.log(`Total system shifts: ${sysShifts.length}`);
    console.log(`Matched: ${matched.length}`);
    console.log(`CSV rows to ADD (missing from system): ${still3.length}`);
    console.log(`System shifts to DELETE (not in CSV): ${unmatchedSys.length}`);
    console.log(`Matched shifts needing end_time fix: ${toUpdate.length}`);

    // Month-by-month breakdown of adds/deletes
    const addByMonth = {};
    for (const csv of still3) {
      const m = csv.date.substring(0, 7);
      addByMonth[m] = (addByMonth[m] || 0) + 1;
    }
    const delByMonth = {};
    for (const s of unmatchedSys) {
      const m = s.shift_date.substring(0, 7);
      delByMonth[m] = (delByMonth[m] || 0) + 1;
    }
    console.log('\nMonth-by-month adds:');
    for (const [m, c] of Object.entries(addByMonth).sort()) console.log(`  ${m}: +${c}`);
    console.log('\nMonth-by-month deletes:');
    for (const [m, c] of Object.entries(delByMonth).sort()) console.log(`  ${m}: -${c}`);

    if (DRY_RUN) {
      console.log('\n--- DRY RUN - no changes made ---');

      if (still3.length > 0) {
        console.log('\nSample CSV rows to ADD (first 15):');
        for (const csv of still3.slice(0, 15)) {
          console.log(`  ${csv.date} ${csv.officer} ${csv.start}-${csv.finish} (${csv.hours}h) @ ${csv.location.substring(0,50)}`);
        }
      }
      if (unmatchedSys.length > 0) {
        console.log('\nSample system shifts to DELETE (first 15):');
        for (const s of unmatchedSys.slice(0, 15)) {
          console.log(`  [id:${s.id}] ${s.shift_date} ${s.employee_name} ${s.start_time}-${s.end_time} @ ${(s.site_name || s.title).substring(0,50)}`);
        }
      }

      await pool.end();
      return;
    }

    // === APPLY CHANGES ===

    // 1. Update end times
    if (toUpdate.length > 0) {
      console.log(`\nUpdating ${toUpdate.length} end times...`);
      for (const m of toUpdate) {
        await pool.query(`UPDATE shifts SET end_time = $1 WHERE id = $2`, [m.csv.finish, m.sys.id]);
      }
      console.log('End times updated.');
    }

    // 2. Delete extra system shifts (cascade through invoice_line_items)
    if (unmatchedSys.length > 0) {
      const idsToDelete = unmatchedSys.map(s => s.id);
      console.log(`\nDeleting ${idsToDelete.length} extra system shifts...`);

      // First delete invoice_line_items referencing these shifts
      const batchSize = 500;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const liRes = await pool.query(`DELETE FROM invoice_line_items WHERE shift_id = ANY($1)`, [batch]);
        if (liRes.rowCount > 0) console.log(`  Deleted ${liRes.rowCount} invoice_line_items (batch ${Math.floor(i/batchSize)+1})`);
      }

      // Now delete orphaned invoices (no remaining line items)
      const orphanRes = await pool.query(`
        DELETE FROM invoices WHERE id IN (
          SELECT i.id FROM invoices i
          LEFT JOIN invoice_line_items ili ON ili.invoice_id = i.id
          WHERE ili.id IS NULL AND i.supplier_id = $1
        )
      `, [SUPPLIER_ID]);
      if (orphanRes.rowCount > 0) console.log(`  Deleted ${orphanRes.rowCount} orphaned invoices`);

      // Now delete the shifts
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        await pool.query(`DELETE FROM shifts WHERE id = ANY($1)`, [batch]);
      }
      console.log('Deleted.');
    }

    // 3. Add missing shifts
    if (still3.length > 0) {
      console.log(`\nAdding ${still3.length} missing shifts...`);

      // Build employee lookup
      const empRes = await pool.query(`
        SELECT e.id, UPPER(u.first_name || ' ' || u.last_name) as name
        FROM employees e JOIN users u ON e.user_id = u.id
        WHERE e.supplier_id = $1
      `, [SUPPLIER_ID]);
      const empByName = {};
      for (const e of empRes.rows) empByName[e.name] = e.id;

      // Build site lookup from existing shifts
      const siteLookup = {};
      for (const s of sysShifts) {
        if (s.site_id) {
          const key = (s.site_name || '').toUpperCase();
          if (key && !siteLookup[key]) siteLookup[key] = s.site_id;
        }
      }

      let added = 0;
      let noEmployee = 0;
      for (const csv of still3) {
        const empName = normalize(csv.officer);
        let empId = empByName[empName] || null;
        if (!empId) {
          for (const [name, id] of Object.entries(empByName)) {
            if (lastNameMatch(csv.officer, name)) {
              const csvFirst = normalize(csv.officer).split(/\s+/)[0];
              const sysFirst = name.split(/\s+/)[0];
              if (csvFirst === sysFirst) { empId = id; break; }
            }
          }
        }
        if (!empId) {
          for (const [name, id] of Object.entries(empByName)) {
            if (lastNameMatch(csv.officer, name)) { empId = id; break; }
          }
        }

        let siteId = null;
        const csvLocUp = csv.location.toUpperCase();
        for (const [name, id] of Object.entries(siteLookup)) {
          if (siteMatch(csv.location, name)) { siteId = id; break; }
        }

        if (!empId) noEmployee++;

        await pool.query(`
          INSERT INTO shifts (tenant_id, supplier_id, site_id, employee_id, title, date, start_time, end_time, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
        `, [TENANT_ID, SUPPLIER_ID, siteId, empId, csv.location, csv.date, csv.start, csv.finish, ]);
        added++;
      }
      console.log(`Added ${added} shifts (${noEmployee} without employee match).`);
    }

    // === VERIFICATION ===
    console.log('\n=== VERIFICATION ===');
    const verifyRes = await pool.query(`
      SELECT TO_CHAR(sh.date::date, 'YYYY-MM') as month, COUNT(*) as cnt,
        SUM(
          CASE WHEN (CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END)::time
            < (CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END)::time
          THEN EXTRACT(EPOCH FROM ((CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END)::time - (CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END)::time + interval '24 hours')) / 3600
          ELSE EXTRACT(EPOCH FROM ((CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END)::time - (CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END)::time)) / 3600
          END
        )::numeric(10,2) as hrs
      FROM shifts sh WHERE sh.supplier_id = $1
      AND sh.date::date >= '2021-04-01' AND sh.date::date <= '2023-03-31'
      GROUP BY TO_CHAR(sh.date::date, 'YYYY-MM') ORDER BY month
    `, [SUPPLIER_ID]);

    const csvByMonth = {};
    for (const csv of csvShifts) {
      const m = csv.date.substring(0, 7);
      if (!csvByMonth[m]) csvByMonth[m] = { count: 0, hours: 0 };
      csvByMonth[m].count++;
      csvByMonth[m].hours += csv.hours;
    }

    console.log('Month     | Sys Cnt | Sys Hours  | CSV Cnt | CSV Hours  | Cnt Diff | Hr Diff');
    console.log('----------|---------|------------|---------|------------|----------|--------');
    for (const r of verifyRes.rows) {
      const c = csvByMonth[r.month] || { count: 0, hours: 0 };
      const cntDiff = parseInt(r.cnt) - c.count;
      const hrDiff = (parseFloat(r.hrs) - c.hours).toFixed(2);
      console.log(
        `${r.month}  | ${String(r.cnt).padStart(7)} | ${String(r.hrs).padStart(10)} | ${String(c.count).padStart(7)} | ${c.hours.toFixed(2).padStart(10)} | ${String(cntDiff).padStart(8)} | ${hrDiff.padStart(6)}`
      );
    }

  } catch (err) {
    console.error('Error:', err);
  }
  await pool.end();
})();
