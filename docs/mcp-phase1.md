# Gardeo MCP — Phase 1

Secure product MCP endpoint so AI hosts (Cursor, Claude Desktop, custom agents) can call **read-only ops tools** with tenant-scoped API keys.

## Enable

1. Apply migration `migrations/0044_mcp_phase1.sql` (or `npm run db:push` if you use Drizzle push).
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

## Tools (ops.read)

| Tool | Description |
|------|-------------|
| `whoami` | Client / tenant / scopes |
| `list_sites` | Paginated sites |
| `list_shifts` | Shifts in a ≤31-day range |
| `get_shift` | One shift by id (tenant-checked) |
| `get_site_coverage` | Book-on coverage for a date |
| `search_employees` | Name / employee number search (sanitized) |

Responses never include NI, bank details, immigration data, document URLs, or pay rates.

## Create a key

**UI:** Settings → Integrations → **Gardeo MCP (AI)** → Create key (shown once).

**API** (tenant_admin / admin / super_admin session):

```http
POST /api/admin/mcp/clients
{ "name": "Cursor", "scopes": ["ops.read"] }
```

Response includes `apiKey` once. Revoke with `POST /api/admin/mcp/keys/:id/revoke`.

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

Store `GARDEO_MCP_TOKEN` in the environment — never commit it.

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

Every tool call is logged to `mcp_tool_invocations` and `audit_logs`.
