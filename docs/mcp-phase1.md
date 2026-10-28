# Gardeo MCP — Phase 1–3

Secure product MCP endpoint for AI hosts (Cursor, Claude Desktop, agents): **read tools**, **proposal-gated writes**, and a **hard deny-list** for sensitive domains.

## Enable

1. Apply migrations:
   - `migrations/0044_mcp_phase1.sql`
   - `migrations/0045_mcp_phase2.sql`
   - `migrations/0046_mcp_oauth.sql`
2. Set env and restart:

```bash
MCP_ENABLED=true
APP_BASE_URL=https://gardeo-source.onrender.com
JWT_SECRET=...   # required for OAuth access tokens
```

## Endpoint

- `POST https://<your-host>/mcp`
- Auth (either):
  - API key: `Authorization: Bearer gdeo_mcp_…`
  - OAuth access token (Claude Sign in now)
- Streamable HTTP (stateless)

## Claude Custom Connector (OAuth / Sign in now)

1. URL: `https://gardeo-source.onrender.com/mcp`
2. Authentication: **Sign in now**
3. OAuth client: **Use Claude's published identity** (CIMD)
4. Add → browser opens Gardeo consent → login with Gardeo user → Allow

Discovery (auto):

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`
- `/oauth/authorize`, `/oauth/token`

Unauthenticated `/mcp` returns `401` + `WWW-Authenticate` so Claude starts OAuth.

## Scopes

| Scope | Access |
|-------|--------|
| `ops.read` | Read tools (default) |
| `ops.write` | Propose / confirm / reject writes |

## Phase 1 reads

`whoami`, `list_sites`, `list_shifts`, `get_shift`, `get_site_coverage`, `search_employees`

## Phase 2 writes (proposals)

`propose_create_shift`, `propose_add_handover_note`, `propose_acknowledge_incident`, `list_pending_proposals`, `confirm_proposal`, `reject_proposal`

## Phase 3

### A — Hard lockdown (never exposed)

Denied domains (also returned by `whoami`):

- Bank / NI / passport / visa / BRP / share code
- Document file URLs / downloads
- Payroll mark-paid / wages mutations
- Invoice delete / reverse-engineer
- External sync triggers / API keys
- Raw SQL / unrestricted internal proxy

### B — Extra reads

| Tool | Description |
|------|-------------|
| `list_open_incidents` | reported / investigating |
| `list_suppliers` | No bank/VAT/finance fields |
| `get_compliance_summary` | SIA/DBS/first-aid bands only |
| `list_today_absences` | Open absences + approved leave for a date |

### C — Extra write proposals

| Tool | Description |
|------|-------------|
| `propose_assign_officer` | Assign employee to shift |
| `propose_cancel_shift` | Cancel shift (+ optional reason) |
| `propose_book_on` | Book on scheduled shift |
| `propose_book_off` | Book off (+ optional handover) |

All writes require `confirm_proposal` (token) or Settings → **Pending proposals** Confirm/Reject. Proposals expire in 30 minutes.

## Cursor config

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

Clients/keys/invocations/proposals — see Settings → Integrations → Gardeo MCP, or:

- `GET/POST /api/admin/mcp/clients`
- `GET /api/admin/mcp/proposals?status=pending`
- `POST /api/admin/mcp/proposals/:id/confirm|reject`
