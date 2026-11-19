// Read-only: reports accounts whose password still matches the old shared default,
// and how many recently active officers have portal access disabled.
// Usage: node script/dryrun-default-password-accounts.mjs [--out=report.json]
import "dotenv/config";
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "Password123!";
const RECENT_LOGIN_DAYS = 30;
const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : "script/dryrun-default-password-report.json";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  const { rows: users } = await pool.query(
    `SELECT u.id, u.tenant_id, u.role, u.is_active, u.last_login_at, u.password,
            e.id AS employee_id, e.portal_access_enabled
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.password LIKE '$2%'`,
  );

  const matches = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (await bcrypt.compare(DEFAULT_PASSWORD, u.password)) {
      matches.push({
        userId: u.id,
        tenantId: u.tenant_id,
        role: u.role,
        isActive: u.is_active,
        employeeId: u.employee_id,
        portalAccessEnabled: u.portal_access_enabled,
        lastLoginAt: u.last_login_at,
      });
    }
    if ((i + 1) % 500 === 0) console.log(`checked ${i + 1}/${users.length}`);
  }

  const byTenantRole = {};
  for (const m of matches) {
    const key = `tenant ${m.tenantId ?? "none"} / ${m.role}`;
    byTenantRole[key] = (byTenantRole[key] || 0) + 1;
  }

  const { rows: [portal] } = await pool.query(
    `SELECT COUNT(*)::int AS recent_officers,
            COUNT(*) FILTER (WHERE COALESCE(e.portal_access_enabled, false) = false)::int AS recent_without_portal
     FROM users u
     JOIN employees e ON e.user_id = u.id
     WHERE u.role = 'employee'
       AND u.is_active IS NOT FALSE
       AND u.last_login_at > NOW() - ($1 || ' days')::interval`,
    [String(RECENT_LOGIN_DAYS)],
  );

  const report = {
    generatedAt: new Date().toISOString(),
    usersChecked: users.length,
    defaultPasswordMatches: matches.length,
    defaultPasswordActive: matches.filter((m) => m.isActive !== false).length,
    byTenantRole,
    officersLoggedInLast30Days: portal.recent_officers,
    officersLoggedInLast30DaysWithoutPortalAccess: portal.recent_without_portal,
    matches,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  const { matches: _omit, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Full list written to ${outPath}`);
} finally {
  await pool.end();
}
