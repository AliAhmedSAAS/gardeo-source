DO $$ BEGIN
  CREATE TYPE hr_case_type AS ENUM ('disciplinary', 'grievance', 'capability', 'appeal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE hr_case_status AS ENUM ('open', 'investigation', 'hearing_scheduled', 'outcome_given', 'appealed', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE hr_case_outcome AS ENUM ('no_action', 'verbal_warning', 'written_warning', 'final_warning', 'dismissal', 'upheld', 'not_upheld');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "hr_cases" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "case_type" hr_case_type NOT NULL,
  "status" hr_case_status NOT NULL DEFAULT 'open',
  "opened_by" varchar NOT NULL REFERENCES "users"("id"),
  "assigned_to" varchar REFERENCES "users"("id"),
  "incident_date" date,
  "allegation_summary" text,
  "hearing_date" timestamp,
  "outcome" hr_case_outcome,
  "outcome_date" date,
  "outcome_notes" text,
  "appeal_deadline" date,
  "closed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "hr_case_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL REFERENCES "hr_cases"("id"),
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "event_type" text NOT NULL,
  "notes" text,
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "hr_case_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL REFERENCES "hr_cases"("id"),
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer,
  "mime_type" text,
  "document_type" text DEFAULT 'evidence',
  "uploaded_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_hr_cases_tenant" ON "hr_cases"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_cases_employee" ON "hr_cases"("employee_id");
CREATE INDEX IF NOT EXISTS "idx_hr_cases_tenant_status" ON "hr_cases"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_hr_case_events_case" ON "hr_case_events"("case_id");
CREATE INDEX IF NOT EXISTS "idx_hr_case_documents_case" ON "hr_case_documents"("case_id");
