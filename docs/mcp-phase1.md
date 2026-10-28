# Gardeo MCP — Phase 1 + Phase 2

Secure product MCP endpoint so AI hosts (Cursor, Claude Desktop, custom agents) can call **read tools** and **propose writes** with tenant-scoped API keys.

## Enable

1. Apply migrations:
   - `migrations/0044_mcp_phase1.sql`
   - `migrations/0045_mcp_phase2.sql`
2. Set env:

```bash
MCP_ENABLED=true
# optional
MCP_RATE_LIMIT_PER_MIN=60
```

3. Restart the server.

## Endpoint

- **URL:** `POST https://<your-host>/mcp`
- **Auth:** `Authorization: Bearer gdeo_mcp_…`
- **Transport:** Streamable HTTP (stateless)

## Scopes

| Scope | Access |
|-------|--------|
| `ops.read` | Read tools (default) |
| `ops.write` | Propose / confirm / reject writes |

New keys default to `ops.read` only. Enable **Allow ops.write** in Settings when creating a key.

## Phase 1 tools (ops.read)

| Tool | Description |
|------|-------------|
| `whoami` | Client / tenant / scopes |
| `list_sites` | Paginated sites |
| `list_shifts` | Shifts in a ≤31-day range |
| `get_shift` | One shift by id (tenant-checked) |
| `get_site_coverage` | Book-on coverage for a date |
| `search_employees` | Name / employee number search (sanitized) |

Responses never include NI, bank details, immigration data, document URLs, or pay rates.

## Phase 2 tools (ops.write)

Writes never apply immediately. They create a **proposal** (30 min TTL) that must be confirmed.

| Tool | Description |
|------|-------------|
| `propose_create_shift` | Draft a scheduled shift |
| `propose_add_handover_note` | Draft handover note on a shift |
| `propose_acknowledge_incident` | Draft incident → investigating |
| `list_pending_proposals` | List this client's pending proposals |
| `confirm_proposal` | Apply with `proposalId` + `confirmToken` |
| `reject_proposal` | Discard with `proposalId` + `confirmToken` |

Human-in-the-loop: Settings → Integrations → **Pending proposals** → Confirm / Reject (no token needed for admins).

## Create a key

**UI:** Settings → Integrations → **Gardeo MCP (AI)** → optionally enable ops.write → Create key (shown once).

**API** (tenant_admin / admin / super_admin session):

```http
POST /api/admin/mcp/clients
{ "name": "Cursor", "scopes": ["ops.read", "ops.write"] }
```

## Cursor `mcp.json` example

```json
{
  "mcpServers": {
    "gardeo": {
      "url": "https://YOUR_DOMAIN/mcp",
      "headers": {
        "Authorization": "Bearer ${env:GARDEO_MCP_TOKEN}"
      }
    }
  }
}
```

## Admin APIs

| Method | Path |
|--------|------|
| GET | `/api/admin/mcp/status` |
| GET | `/api/admin/mcp/clients` |
| POST | `/api/admin/mcp/clients` |
| POST | `/api/admin/mcp/clients/:id/keys` |
| PATCH | `/api/admin/mcp/clients/:id` |
| POST | `/api/admin/mcp/keys/:id/revoke` |
| GET | `/api/admin/mcp/invocations` |
| GET | `/api/admin/mcp/proposals?status=pending` |
| POST | `/api/admin/mcp/proposals/:id/confirm` |
| POST | `/api/admin/mcp/proposals/:id/reject` |

Every tool call is logged to `mcp_tool_invocations` and `audit_logs`. Proposal lifecycle is logged on create/confirm/reject.
