-- Per-tenant SMTP / email sending configuration

CREATE TABLE IF NOT EXISTS "tenant_email_settings" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "provider" text NOT NULL DEFAULT 'smtp',
  "from_name" text,
  "from_email" text,
  "reply_to_email" text,
  "smtp_host" text,
  "smtp_port" integer DEFAULT 587,
  "smtp_secure" boolean NOT NULL DEFAULT false,
  "smtp_user" text,
  "smtp_password_encrypted" text,
  "resend_api_key_encrypted" text,
  "last_tested_at" timestamp,
  "last_test_status" text,
  "last_error" text,
  "updated_by" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tenant_email_settings_tenant" ON "tenant_email_settings" ("tenant_id");
