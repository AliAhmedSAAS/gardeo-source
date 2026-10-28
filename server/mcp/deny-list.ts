/**
 * Phase 3 hard lockdown — domains Gardeo MCP must never expose as tools
 * or return in payloads (even via proposals).
 */
export const MCP_DENIED_DOMAINS = [
  {
    id: "pii_bank",
    reason: "Bank account / sort code / NI / passport / visa / BRP / share code",
  },
  {
    id: "documents_download",
    reason: "Staff/supplier document file URLs and downloads",
  },
  {
    id: "payroll_mutate",
    reason: "Mark paid, payroll approve/reject, wages ledger writes",
  },
  {
    id: "invoice_destructive",
    reason: "Invoice/credit/debit delete, reverse-engineer shifts",
  },
  {
    id: "external_sync",
    reason: "External sync API keys, resync triggers, GFMTrack push",
  },
  {
    id: "raw_sql",
    reason: "Arbitrary SQL or unrestricted internal HTTP proxy",
  },
] as const;

export type McpDeniedDomainId = (typeof MCP_DENIED_DOMAINS)[number]["id"];

const DENIED_FIELD_PATTERN =
  /national_?insurance|ni_?number|sort_?code|account_?number|iban|passport|visa|brp|share_?code|bank_name|file_url|certificate_url|fit_note|password|api_?key|secret|token/i;

/** Strip known-sensitive keys from plain objects before returning to MCP clients. */
export function stripDeniedFields<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (DENIED_FIELD_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

export function assertAllowedMcpCapability(capability: string): void {
  const denied = MCP_DENIED_DOMAINS.find(
    (d) =>
      capability === d.id ||
      capability.startsWith(`${d.id}.`) ||
      capability.includes(d.id),
  );
  if (denied) {
    throw new Error(`MCP capability blocked (${denied.id}): ${denied.reason}`);
  }
}
