-- SIA public register verification tracking on employees

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "sia_last_verified_at" timestamp;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "sia_register_status" text;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "sia_register_holder_name" text;
