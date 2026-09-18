ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "employment_vetting_automation_enabled" boolean DEFAULT false;
