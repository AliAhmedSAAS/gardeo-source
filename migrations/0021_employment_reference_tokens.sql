-- Secure tokens for external employment reference verification forms

CREATE TABLE IF NOT EXISTS "employment_reference_tokens" (
  "id" serial PRIMARY KEY,
  "token" varchar(64) NOT NULL UNIQUE,
  "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
  "employee_id" integer NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "employment_history_id" integer NOT NULL REFERENCES "employment_history"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "information_confirmed" boolean,
  "details_if_different" text,
  "attitude" text,
  "time_keeping" text,
  "time_off" text,
  "reason_for_leaving" text,
  "would_reemploy" text,
  "referee_print_name" text,
  "referee_company" text,
  "referee_position" text,
  "referee_signature" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_emp_ref_tokens_token" ON "employment_reference_tokens" ("token");
CREATE INDEX IF NOT EXISTS "idx_emp_ref_tokens_hist" ON "employment_reference_tokens" ("employment_history_id");
