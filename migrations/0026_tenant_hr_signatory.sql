-- HR / vetting signatory for screening documents (separate from self-billing)

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hr_signatory_name" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hr_signatory_position" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hr_signature_data" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hr_signature_date" timestamp;
