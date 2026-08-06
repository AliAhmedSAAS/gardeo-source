-- Per-tenant officer type options (defaults seeded for all tenants)

CREATE TABLE IF NOT EXISTS "tenant_officer_types" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_officer_types_tenant_name"
  ON "tenant_officer_types" ("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "idx_tenant_officer_types_tenant"
  ON "tenant_officer_types" ("tenant_id");

-- Seed defaults for existing tenants (skip duplicates)
INSERT INTO "tenant_officer_types" ("tenant_id", "name", "sort_order")
SELECT t.id, d.name, d.sort_order
FROM "tenants" t
CROSS JOIN (
  VALUES
    ('Door Supervisor', 1),
    ('Security Guard', 2),
    ('Steward', 3),
    ('Construction', 4),
    ('Cleaners', 5),
    ('CCTV Operator', 6),
    ('Fire Marshall', 7),
    ('Personal Licence', 8),
    ('Close Protection', 9),
    ('LFT Tester', 10)
) AS d(name, sort_order)
ON CONFLICT DO NOTHING;
