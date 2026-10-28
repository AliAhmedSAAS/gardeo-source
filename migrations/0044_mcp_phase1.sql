-- Phase 1 product MCP: tenant-scoped clients, hashed API keys, tool audit log.

CREATE TABLE IF NOT EXISTS mcp_clients (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['ops.read']::text[],
  status text NOT NULL DEFAULT 'active',
  created_by_user_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_clients_tenant ON mcp_clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_clients_tenant_status ON mcp_clients (tenant_id, status);

CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES mcp_clients(id) ON DELETE CASCADE,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  label text,
  expires_at timestamp,
  last_used_at timestamp,
  revoked_at timestamp,
  created_by_user_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_tenant ON mcp_api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_client ON mcp_api_keys (client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_prefix ON mcp_api_keys (key_prefix);

CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  client_id integer REFERENCES mcp_clients(id) ON DELETE SET NULL,
  api_key_id integer REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  args_fingerprint text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  latency_ms integer,
  ip_address text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_invocations_tenant_created ON mcp_tool_invocations (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_client ON mcp_tool_invocations (client_id);
