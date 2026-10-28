-- Phase 2 product MCP: human-in-the-loop write proposals.

CREATE TABLE IF NOT EXISTS mcp_proposals (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  client_id integer REFERENCES mcp_clients(id) ON DELETE SET NULL,
  api_key_id integer REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
  proposal_type text NOT NULL,
  payload jsonb NOT NULL,
  summary text NOT NULL,
  confirm_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error_message text,
  expires_at timestamp NOT NULL,
  confirmed_at timestamp,
  confirmed_by_user_id varchar REFERENCES users(id),
  rejected_at timestamp,
  rejected_by_user_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_proposals_tenant_status ON mcp_proposals (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mcp_proposals_tenant_created ON mcp_proposals (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_proposals_client ON mcp_proposals (client_id);
