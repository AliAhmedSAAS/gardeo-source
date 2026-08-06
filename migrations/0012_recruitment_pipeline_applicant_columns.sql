-- HR-08: Recruitment pipeline offer flow, interview scheduling, and hire-to-onboard
-- Adds new columns to the applicants table for full pipeline tracking

ALTER TABLE "applicants"
  ADD COLUMN IF NOT EXISTS "source" text,
  ADD COLUMN IF NOT EXISTS "offer_date" date,
  ADD COLUMN IF NOT EXISTS "offer_salary" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "offer_status" text,
  ADD COLUMN IF NOT EXISTS "hired_at" timestamp,
  ADD COLUMN IF NOT EXISTS "interview_location" text,
  ADD COLUMN IF NOT EXISTS "interview_link" text,
  ADD COLUMN IF NOT EXISTS "interviewer_name" text,
  ADD COLUMN IF NOT EXISTS "interviewer_id" text REFERENCES "users"("id");
