ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "book_on_call_data" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_check_calls" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer REFERENCES "tenants"("id") ON DELETE cascade,
  "shift_id" integer NOT NULL REFERENCES "shifts"("id") ON DELETE cascade,
  "due_at" timestamp NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "taken_at" timestamp,
  "taken_by" varchar,
  "method" text,
  "reason" text,
  "reason_other" text,
  "photo_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_check_calls_shift" ON "shift_check_calls" ("shift_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_check_calls_tenant_status" ON "shift_check_calls" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_check_calls_due" ON "shift_check_calls" ("due_at");
