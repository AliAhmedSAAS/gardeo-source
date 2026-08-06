-- Xero OAuth 2.0 integration: per-tenant connection credentials and state
CREATE TABLE IF NOT EXISTS "tenant_xero_connections" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL UNIQUE,
  "client_id" text,
  "client_secret" text,
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamp,
  "xero_tenant_id" text,
  "xero_tenant_name" text,
  "connection_status" text DEFAULT 'disconnected' NOT NULL,
  "oauth_state" text,
  "sync_enabled" boolean DEFAULT false NOT NULL,
  "sync_interval_minutes" integer DEFAULT 60 NOT NULL,
  "last_synced_at" timestamp,
  "last_error" text,
  "connected_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_xero_conn_tenant" ON "tenant_xero_connections" ("tenant_id");

-- Per-record sync state tracking for all entities pushed to Xero
CREATE TABLE IF NOT EXISTS "xero_sync_records" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" integer NOT NULL,
  "xero_id" text,
  "sync_status" text DEFAULT 'pending' NOT NULL,
  "last_error" text,
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_xero_sync_tenant" ON "xero_sync_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_xero_sync_tenant_type" ON "xero_sync_records" ("tenant_id", "entity_type");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_xero_sync_tenant_entity" ON "xero_sync_records" ("tenant_id", "entity_type", "entity_id");
