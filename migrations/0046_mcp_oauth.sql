-- MCP OAuth for Claude Custom Connector (authorization code + PKCE + CIMD).

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id serial PRIMARY KEY,
  code_hash text NOT NULL,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope text NOT NULL DEFAULT 'ops.read',
  resource text,
  user_id varchar NOT NULL REFERENCES users(id),
  tenant_id integer NOT NULL REFERENCES tenants(id),
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_hash ON mcp_oauth_codes (code_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_tenant ON mcp_oauth_codes (tenant_id);

CREATE TABLE IF NOT EXISTS mcp_oauth_refresh_tokens (
  id serial PRIMARY KEY,
  token_hash text NOT NULL,
  client_id text NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id),
  tenant_id integer NOT NULL REFERENCES tenants(id),
  scopes text[] NOT NULL DEFAULT ARRAY['ops.read']::text[],
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_refresh_hash ON mcp_oauth_refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_refresh_user ON mcp_oauth_refresh_tokens (user_id);
