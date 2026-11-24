/**
 * Geocodes in-house officer postcodes (postcodes.io) so Broadcast radius search
 * does not have to do it on the first request.
 * Usage: npx tsx script/broadcast-geocode-backfill.ts [tenantId]
 */
import "dotenv/config";
import { pool } from "../server/db";
import { geocodePendingEmployees } from "../server/broadcast/geocode";

async function main() {
  const onlyTenant = process.argv[2] ? Number(process.argv[2]) : null;
  const { rows } = await pool.query<{ id: number }>(
    onlyTenant ? "SELECT id FROM tenants WHERE id = $1" : "SELECT id FROM tenants ORDER BY id",
    onlyTenant ? [onlyTenant] : [],
  );

  for (const { id } of rows) {
    let total = 0;
    for (;;) {
      const { updated, remaining } = await geocodePendingEmployees(id, 1000);
      total += updated;
      if (remaining === 0) break;
    }
    const { rows: [stats] } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE latitude IS NOT NULL) AS located,
              COUNT(*) FILTER (WHERE geocoded_postcode IS NOT NULL AND latitude IS NULL) AS not_found
         FROM employees WHERE tenant_id = $1`,
      [id],
    );
    console.log(`tenant ${id}: processed ${total}, located ${stats.located}, postcode not found ${stats.not_found}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
