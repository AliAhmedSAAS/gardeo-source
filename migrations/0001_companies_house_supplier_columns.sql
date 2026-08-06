-- Companies House profile columns for suppliers (from Companies House lookup)
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "company_category" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "company_status" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "country_of_origin" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "incorporation_date" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "sic_codes" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "registered_office_country" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "accounts_next_due" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "accounts_last_made_up_date" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "account_category" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "accounts_account_ref_day" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "accounts_account_ref_month" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "returns_next_due" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "returns_last_made_up_date" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "previous_names" jsonb;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "mortgages" jsonb;
