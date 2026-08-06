CREATE UNIQUE INDEX IF NOT EXISTS "users_null_tenant_email_unique" ON "users" ("email") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_null_tenant_username_unique" ON "users" ("username") WHERE "tenant_id" IS NULL;
