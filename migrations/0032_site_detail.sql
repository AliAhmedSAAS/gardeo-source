ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "book_on_email_enabled" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "check_call_enabled" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "check_call_interval_minutes" integer DEFAULT 60;
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "check_call_schedule_mode" text DEFAULT 'full_day';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_charge_rates" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "site_id" integer NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "duty_type_id" integer NOT NULL,
  "hourly_charge_rate" numeric(10, 2) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_charge_rates_site" ON "site_charge_rates" ("site_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_site_charge_rates_site_duty" ON "site_charge_rates" ("site_id", "duty_type_id", "effective_from");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer REFERENCES "tenants"("id"),
  "site_id" integer NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "document_type" text DEFAULT 'other' NOT NULL,
  "display_name" text,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer,
  "mime_type" text,
  "uploaded_by" varchar,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_documents_site" ON "site_documents" ("site_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer REFERENCES "tenants"("id"),
  "site_id" integer NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_notes_site" ON "site_notes" ("site_id");
