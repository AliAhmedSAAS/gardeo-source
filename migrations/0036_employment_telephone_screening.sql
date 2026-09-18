ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "verbally_confirmed_at" timestamptz;

ALTER TABLE "vetting_audit_events" ADD COLUMN IF NOT EXISTS "employment_history_id" integer REFERENCES "employment_history"("id") ON DELETE SET NULL;
ALTER TABLE "vetting_audit_events" ADD COLUMN IF NOT EXISTS "event_type" text;
ALTER TABLE "vetting_audit_events" ADD COLUMN IF NOT EXISTS "event_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_vetting_audit_event_at" ON "vetting_audit_events" ("employee_id", "event_at");
