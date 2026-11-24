-- Elastic Email as a per-tenant email provider.

ALTER TABLE tenant_email_settings ADD COLUMN IF NOT EXISTS elastic_email_api_key_encrypted text;
