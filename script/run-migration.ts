/**
 * Run a single migration SQL file.
 * Usage: npx tsx script/run-migration.ts migrations/0004_notifications_field_requests_profile_log.sql
 * Requires: DATABASE_URL in .env
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pool } from "../server/db";

const migrationPath = process.argv[2] || "migrations/0004_notifications_field_requests_profile_log.sql";
const absolutePath = resolve(process.cwd(), migrationPath);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL must be set. Add it to .env");
    process.exit(1);
  }
  const sql = readFileSync(absolutePath, "utf8");
  console.log("Running migration:", absolutePath);
  await pool.query(sql);
  console.log("Migration completed successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
