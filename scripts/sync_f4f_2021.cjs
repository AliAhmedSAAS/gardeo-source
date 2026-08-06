const fs = require('fs');
const { Pool } = require('/home/runner/workspace/node_modules/pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalize(name) {
  return name.toUpperCase().replace(/[^A-Z ]/g, '').trim();
}

function lastNameMatch(csvOfficer, sysEmployee) {
  const csvParts = normalize(csvOfficer).split(/\s+/);
  const sysParts = normalize(sysEmployee).split(/\s+/);
  const csvLast = csvParts[csvParts.length - 1];
  const sysLast = sysParts[sysParts.length - 1];
  if (csvLast === sysLast) return true;
  if (sysParts.some(p => p === csvLast)) return true;
  if (csvParts.some(p => p === sysLast)) return true;
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

(async () => {
  try {
    const lines = fs.readFileSync('/home/runner/workspace/attached_assets/F4F_2021_1772673884188.csv', 'utf8')
      .trim().split('\n').slice(1);

    const csvShifts = lines.map((line, idx) => {
      const parts = line.split(',');
      const [dd, mm, yyyy] = parts[0].split('/');
      return {
        idx,
        date: `${yyyy}-${mm}-${dd}`,
        location: parts[1],
        officer: parts[3],
        start: parts[4],
        finish: parts[5],
        hours: parseFloat(parts[6]),
        rate: parseFloat(parts[7]),
      };
    });

    const sysRes = await pool.query(`
      SELECT sh.id, sh.date::text as shift_date,
        CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END AS start_time,
        CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END AS end_time,
        sh.break_minutes,
        COALESCE(UPPER(u.first_name || ' ' || u.last_name), 'UNASSIGNED') as employee_name,
        COALESCE(si.name, 'Unknown') as site_name
      FROM shifts sh
      LEFT JOIN sites si ON sh.site_id = si.id
      LEFT JOIN employees e ON sh.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE sh.supplier_id = 18
      AND EXTRACT(YEAR FROM sh.date::date) = 2021
      ORDER BY sh.date ASC
    `);

    const sysShifts = sysRes.rows;
    console.log(`CSV rows: ${csvShifts.length}`);
    console.log(`System shifts: ${sysShifts.length}`);

    const usedSysIds = new Set();
    const matched = [];
    const unmatched = [];

    // Pass 1: strict match (date + start + last name)
    for (const csv of csvShifts) {
      const candidates = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        !usedSysIds.has(s.id) &&
        lastNameMatch(csv.officer, s.employee_name)
      );
      if (candidates.length > 0) {
        const best = candidates[0];
        usedSysIds.add(best.id);
        matched.push({ csv, sys: best });
      } else {
        unmatched.push(csv);
      }
    }

    console.log(`Pass 1 matched: ${matched.length}, unmatched: ${unmatched.length}`);

    // Pass 2: try date + start + site match for remaining
    const stillUnmatched = [];
    for (const csv of unmatched) {
      const candidates = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        !usedSysIds.has(s.id) &&
        siteMatch(csv.location, s.site_name)
      );
      if (candidates.length > 0) {
        const best = candidates[0];
        usedSysIds.add(best.id);
        matched.push({ csv, sys: best });
      } else {
        stillUnmatched.push(csv);
      }
    }

    console.log(`Pass 2 matched: ${matched.length}, still unmatched: ${stillUnmatched.length}`);

    // Pass 3: date + start only (pick first available)
    const finalUnmatched = [];
    for (const csv of stillUnmatched) {
      const candidates = sysShifts.filter(s =>
        s.shift_date === csv.date &&
        s.start_time === csv.start &&
        !usedSysIds.has(s.id)
      );
      if (candidates.length > 0) {
        const best = candidates[0];
        usedSysIds.add(best.id);
        matched.push({ csv, sys: best });
        console.log(`  Pass 3 matched: CSV ${csv.date} ${csv.officer} ${csv.start}-${csv.finish} -> SYS ${best.employee_name} ${best.start_time}-${best.end_time} [id:${best.id}]`);
      } else {
        finalUnmatched.push(csv);
      }
    }

    console.log(`\nFinal matched: ${matched.length}, final unmatched: ${finalUnmatched.length}`);

    if (finalUnmatched.length > 0) {
      console.log('\nUnmatched CSV rows:');
      for (const csv of finalUnmatched) {
        console.log(`  ${csv.date} ${csv.officer} ${csv.start}-${csv.finish} (${csv.hours}h) @ ${csv.location}`);
      }
    }

    // Find shifts needing end_time updates
    const toUpdate = matched.filter(m => m.sys.end_time !== m.csv.finish);
    console.log(`\nShifts needing end_time update: ${toUpdate.length}`);

    if (toUpdate.length > 0) {
      console.log('\nUpdating end times...');
      let updated = 0;
      for (const m of toUpdate) {
        await pool.query(
          `UPDATE shifts SET end_time = $1 WHERE id = $2`,
          [m.csv.finish, m.sys.id]
        );
        updated++;
      }
      console.log(`Updated ${updated} shifts.`);

      // Show sample updates
      console.log('\nSample updates (first 20):');
      for (const m of toUpdate.slice(0, 20)) {
        console.log(`  [id:${m.sys.id}] ${m.csv.date} ${m.csv.officer}: ${m.sys.end_time} -> ${m.csv.finish} (CSV hrs: ${m.csv.hours})`);
      }
    }

    // Verify month-by-month totals
    console.log('\n--- Verification: Month-by-month hours after sync ---');
    const verifyRes = await pool.query(`
      SELECT 
        TO_CHAR(sh.date::date, 'YYYY-MM') as month,
        COUNT(*) as shift_count,
        SUM(
          CASE 
            WHEN (
              CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END
            )::time < (
              CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END
            )::time
            THEN EXTRACT(EPOCH FROM (
              (CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END)::time
              - (CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END)::time
              + interval '24 hours'
            )) / 3600
            ELSE EXTRACT(EPOCH FROM (
              (CASE WHEN sh.end_time LIKE '____-__-__ %' THEN SUBSTRING(sh.end_time FROM 12 FOR 5) ELSE LEFT(sh.end_time, 5) END)::time
              - (CASE WHEN sh.start_time LIKE '____-__-__ %' THEN SUBSTRING(sh.start_time FROM 12 FOR 5) ELSE LEFT(sh.start_time, 5) END)::time
            )) / 3600
          END
        )::numeric(10,2) as total_hours
      FROM shifts sh
      WHERE sh.supplier_id = 18
      AND EXTRACT(YEAR FROM sh.date::date) = 2021
      GROUP BY TO_CHAR(sh.date::date, 'YYYY-MM')
      ORDER BY month
    `);

    // CSV totals by month
    const csvByMonth = {};
    for (const csv of csvShifts) {
      const month = csv.date.substring(0, 7);
      if (!csvByMonth[month]) csvByMonth[month] = { count: 0, hours: 0 };
      csvByMonth[month].count++;
      csvByMonth[month].hours += csv.hours;
    }

    console.log('Month     | Sys Shifts | Sys Hours  | CSV Shifts | CSV Hours  | Diff');
    console.log('----------|-----------|------------|-----------|------------|------');
    for (const row of verifyRes.rows) {
      const csvM = csvByMonth[row.month] || { count: 0, hours: 0 };
      const diff = (parseFloat(row.total_hours) - csvM.hours).toFixed(2);
      console.log(
        `${row.month}  | ${String(row.shift_count).padStart(9)} | ${String(row.total_hours).padStart(10)} | ${String(csvM.count).padStart(9)} | ${csvM.hours.toFixed(2).padStart(10)} | ${diff}`
      );
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
