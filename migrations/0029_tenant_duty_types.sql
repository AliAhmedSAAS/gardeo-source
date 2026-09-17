CREATE TABLE IF NOT EXISTS "tenant_duty_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "requires_license" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_duty_types_tenant_name" ON "tenant_duty_types" ("tenant_id", "name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenant_duty_types_tenant" ON "tenant_duty_types" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "duty_type_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "shifts_duty_type_id_tenant_duty_types_id_fk"
    FOREIGN KEY ("duty_type_id") REFERENCES "tenant_duty_types"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
