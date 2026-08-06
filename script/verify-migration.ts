import "dotenv/config";
import { pool } from "../server/db";

async function main() {
  const r = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('notifications', 'supplier_field_requests', 'supplier_profile_change_log')
    ORDER BY table_name
  `);
  console.log("Tables:", r.rows.map((x: { table_name: string }) => x.table_name));
  const c = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid IN ('notifications'::regclass, 'supplier_field_requests'::regclass, 'supplier_profile_change_log'::regclass)
    AND contype = 'f'
    ORDER BY conname
  `);
  console.log("Foreign keys:", c.rows.map((x: { conname: string }) => x.conname));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
