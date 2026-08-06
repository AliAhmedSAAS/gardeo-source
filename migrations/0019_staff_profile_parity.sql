-- GFMTrack Staff Profile parity: employee columns + supporting tables

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "officer_step" integer DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "vetting_start_date" date;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "vetting_complete_at" timestamp;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "contract_end_date" date;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "sage_id" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "second_phone" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "ethnic_origin" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "payment_type" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "permit_type" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "officer_type" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "living_from" date;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_address_line_1" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_address_line_2" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_city" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_county" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_postcode" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_living_from" date;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "previous_living_to" date;

ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "request_count" integer DEFAULT 0;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "requested_date" date;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "info_supplied" boolean;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "how_long_known" text;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "screening_comments" text;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "reference_kind" text DEFAULT 'personal';

ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "request_count" integer DEFAULT 0;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "requested_date" date;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "referee_phone" text;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "referee_email" text;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "confirmed_from" date;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "confirmed_to" date;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "screening_comments" text;

DO $$ BEGIN
  CREATE TYPE "site_preference_type" AS ENUM ('preferred', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "p_form_status" AS ENUM ('locked', 'pending', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "right_of_work_status" AS ENUM ('pending', 'valid', 'expired', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "employee_address_history" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "address_line_1" text NOT NULL,
  "address_line_2" text,
  "city" text,
  "county" text,
  "postcode" text,
  "living_from" date,
  "living_to" date,
  "is_current" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_emp_address_history_employee" ON "employee_address_history" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_notes" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "body" text NOT NULL,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_employee_notes_employee" ON "employee_notes" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_preferred_sites" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "site_id" integer NOT NULL,
  "preference_type" "site_preference_type" NOT NULL DEFAULT 'preferred',
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_emp_preferred_sites_employee" ON "employee_preferred_sites" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_education" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "institution" text NOT NULL,
  "qualification" text,
  "date_from" date,
  "date_to" date,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_employee_education_employee" ON "employee_education" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_driving_licences" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "licence_number" text,
  "categories" text,
  "issue_date" date,
  "expiry_date" date,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_employee_driving_employee" ON "employee_driving_licences" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_health" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "heart_problems" text,
  "eye_problems" text,
  "ear_problems" text,
  "back_problems" text,
  "chest_problems" text,
  "asthma" text,
  "depression" text,
  "skin_rashes" text,
  "diabetes" text,
  "been_ill" text,
  "arthritis" text,
  "cough" text,
  "current_illness" text,
  "color_blind" text,
  "smoke" text,
  "jaundice" text,
  "migraine" text,
  "seriously_injured" text,
  "disability" text,
  "nerve" text,
  "tendons" text,
  "rheumatic_fever" text,
  "rupture" text,
  "nasal_problems" text,
  "high_blood_pressure" text,
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_employee_health_employee" ON "employee_health" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_certificates" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  "issuer" text,
  "issue_date" date,
  "expiry_date" date,
  "file_url" text,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_employee_certificates_employee" ON "employee_certificates" ("employee_id");

CREATE TABLE IF NOT EXISTS "employee_sia_licences" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "sia_number" text NOT NULL,
  "expiry_date" date,
  "licence_sector" text,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_employee_sia_licences_employee" ON "employee_sia_licences" ("employee_id");

CREATE TABLE IF NOT EXISTS "p_form_records" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "status" "p_form_status" NOT NULL DEFAULT 'locked',
  "unlocked_at" timestamp,
  "unlocked_by" varchar REFERENCES "users"("id"),
  "finished_at" timestamp,
  "pdf_url" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_p_form_employee" ON "p_form_records" ("employee_id");

CREATE TABLE IF NOT EXISTS "vetting_audit_events" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "code" text NOT NULL,
  "action" text NOT NULL,
  "details" text,
  "color_key" text,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_vetting_audit_employee" ON "vetting_audit_events" ("employee_id");

CREATE TABLE IF NOT EXISTS "right_of_work_checks" (
  "id" serial PRIMARY KEY,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "tenant_id" integer REFERENCES "tenants"("id"),
  "last_upload_at" timestamp,
  "next_review_at" timestamp,
  "status" "right_of_work_status" DEFAULT 'pending',
  "notes" text,
  "document_id" integer REFERENCES "documents"("id"),
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_row_checks_employee" ON "right_of_work_checks" ("employee_id");
