import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isLocalDb = /^(localhost|127\.0\.0\.1)$/.test(
  new URL(process.env.DATABASE_URL).hostname,
);

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  },
});
