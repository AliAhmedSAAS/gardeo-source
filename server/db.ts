import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Managed Postgres providers (Render, Heroku, etc.) require SSL and typically
// present a certificate chain that isn't in Node's default trust store, so we
// skip strict verification for anything that isn't a local database.
export const isLocalDb = /^(localhost|127\.0\.0\.1)$/.test(
  new URL(process.env.DATABASE_URL).hostname,
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
