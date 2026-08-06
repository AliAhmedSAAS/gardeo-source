-- Add personal and health profile fields used by screening templates

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "marital_status" text;

ALTER TABLE "employee_health" ADD COLUMN IF NOT EXISTS "height" text;
ALTER TABLE "employee_health" ADD COLUMN IF NOT EXISTS "weight" text;
ALTER TABLE "employee_health" ADD COLUMN IF NOT EXISTS "colour_of_eyes" text;
