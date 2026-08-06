DO $$ BEGIN
  CREATE TYPE "absence_type" AS ENUM('sickness', 'unauthorised', 'compassionate', 'paternity', 'maternity', 'jury_duty', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "absence_status" AS ENUM('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "absence_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "absence_type" "absence_type" NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "total_days" integer,
  "reason" text,
  "self_certified" boolean DEFAULT false,
  "fit_note_url" text,
  "return_to_work_conducted" boolean DEFAULT false,
  "return_to_work_date" date,
  "return_to_work_notes" text,
  "reviewed_by" varchar REFERENCES "users"("id"),
  "status" "absence_status" DEFAULT 'open',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_absence_records_tenant_id" ON "absence_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_absence_records_employee_id" ON "absence_records" ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_absence_records_tenant_employee" ON "absence_records" ("tenant_id", "employee_id");
CREATE INDEX IF NOT EXISTS "idx_absence_records_start_date" ON "absence_records" ("tenant_id", "start_date");
