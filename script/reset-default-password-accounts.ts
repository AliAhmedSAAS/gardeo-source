/**
 * Invalidates passwords that still match the old shared default.
 * Officers and supplier users get the onboarding placeholder (they must be re-invited);
 * all other roles get a random password plus a forced-reset email.
 *
 * Dry run (default, read-only):  npx tsx script/reset-default-password-accounts.ts --exclude-tenants=12
 * Apply:                         npx tsx script/reset-default-password-accounts.ts --exclude-tenants=12 --apply
 */
import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { sendForcedPasswordReset } from "../server/email";
import { ONBOARDING_PASSWORD_PLACEHOLDER } from "../server/login-policy";

const DEFAULT_PASSWORD = "Password123!";
const REINVITE_ROLES = ["employee", "supplier"];

const apply = process.argv.includes("--apply");
const excludeArg = process.argv.find((a) => a.startsWith("--exclude-tenants="));
const excludedTenants = excludeArg
  ? excludeArg.slice("--exclude-tenants=".length).split(",").map((s) => parseInt(s, 10)).filter(Number.isInteger)
  : [];

type Action = "reinvite" | "reset_email";

async function findDefaultPasswordUsers() {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, role, email, username, first_name, last_name, password
     FROM users
     WHERE password LIKE '$2%' AND is_active IS NOT FALSE
       AND (tenant_id IS NULL OR NOT (tenant_id = ANY($1::int[])))`,
    [excludedTenants],
  );
  const matches = [];
  for (const u of rows) {
    if (await bcrypt.compare(DEFAULT_PASSWORD, u.password)) matches.push(u);
  }
  return matches;
}

async function main() {
  const publicBase = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (apply && !publicBase) throw new Error("PUBLIC_APP_URL or APP_URL must be set to build reset links");

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}; excluded tenants: ${excludedTenants.join(", ") || "none"}`);
  const users = await findDefaultPasswordUsers();
  const plan = users.map((u) => ({
    user: u,
    action: (REINVITE_ROLES.includes(u.role) ? "reinvite" : "reset_email") as Action,
  }));

  const summary: Record<string, number> = {};
  for (const { user, action } of plan) {
    const key = `tenant ${user.tenant_id ?? "none"} / ${user.role} / ${action}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  console.log(`Accounts matched: ${plan.length}`);
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to make changes.");
    return;
  }

  let emailFailures = 0;
  for (const { user, action } of plan) {
    if (action === "reinvite") {
      await storage.updateUser(user.id, { password: ONBOARDING_PASSWORD_PLACEHOLDER });
    } else {
      const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      await storage.updateUser(user.id, { password: randomHash });
      const token = crypto.randomBytes(32).toString("hex");
      await storage.deletePasswordResetTokensByUserId(user.id);
      await storage.createPasswordResetToken({
        userId: user.id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const result = await sendForcedPasswordReset({
        to: user.email,
        resetLink: `${publicBase}/reset-password?token=${token}`,
        contactName: `${user.first_name} ${user.last_name}`.trim() || user.username,
      });
      if (!result.ok) {
        emailFailures++;
        console.error(`Reset email failed for user ${user.id}: ${result.error ?? "unknown error"}`);
      }
    }
    if (user.tenant_id != null) {
      await storage.createAuditLog({
        tenantId: user.tenant_id,
        userId: user.id,
        action: "password_forced_reset",
        entityType: "user",
        entityId: user.id,
        details: { reason: "shared_default_password", method: action },
      });
    }
  }
  console.log(`Done. ${plan.length} accounts updated; ${emailFailures} reset emails failed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
