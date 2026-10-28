import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  mcpApiKeys,
  mcpClients,
  MCP_SCOPES,
  type McpScope,
} from "@shared/schema";
import type { McpAuthContext } from "./context";

const KEY_PREFIX = "gdeo_mcp_";

export function generateMcpApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const secret = crypto.randomBytes(32).toString("hex");
  const rawKey = `${KEY_PREFIX}${secret}`;
  const keyPrefix = rawKey.slice(0, 16);
  const keyHash = bcrypt.hashSync(rawKey, 10);
  return { rawKey, keyPrefix, keyHash };
}

function normalizeScopes(scopes: string[] | null | undefined): McpScope[] {
  const allowed = new Set<string>(MCP_SCOPES);
  const list = (scopes || []).filter((s) => allowed.has(s)) as McpScope[];
  return list.length > 0 ? list : (["ops.read"] as McpScope[]);
}

export async function authenticateMcpBearer(
  authorization: string | undefined,
  ipAddress: string | null,
): Promise<McpAuthContext | null> {
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  const rawKey = authorization.slice(7).trim();
  if (!rawKey.startsWith(KEY_PREFIX) || rawKey.length < 24) return null;

  const keyPrefix = rawKey.slice(0, 16);
  const candidates = await db
    .select({
      keyId: mcpApiKeys.id,
      keyHash: mcpApiKeys.keyHash,
      expiresAt: mcpApiKeys.expiresAt,
      clientId: mcpClients.id,
      clientName: mcpClients.name,
      tenantId: mcpClients.tenantId,
      scopes: mcpClients.scopes,
    })
    .from(mcpApiKeys)
    .innerJoin(mcpClients, eq(mcpApiKeys.clientId, mcpClients.id))
    .where(
      and(
        eq(mcpApiKeys.keyPrefix, keyPrefix),
        isNull(mcpApiKeys.revokedAt),
        eq(mcpClients.status, "active"),
      ),
    );

  for (const row of candidates) {
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) continue;
    const ok = await bcrypt.compare(rawKey, row.keyHash);
    if (!ok) continue;

    void db
      .update(mcpApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(mcpApiKeys.id, row.keyId))
      .then(() => undefined)
      .catch(() => undefined);

    return {
      tenantId: row.tenantId,
      clientId: row.clientId,
      clientName: row.clientName,
      apiKeyId: row.keyId,
      authType: "api_key",
      scopes: normalizeScopes(row.scopes),
      ipAddress,
    };
  }

  return null;
}
