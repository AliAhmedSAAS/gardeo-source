import type { McpScope } from "@shared/schema";

export type McpAuthContext = {
  tenantId: number;
  clientId: number;
  clientName: string;
  apiKeyId: number;
  scopes: McpScope[];
  ipAddress: string | null;
};

export function assertScope(ctx: McpAuthContext, scope: McpScope): void {
  if (!ctx.scopes.includes(scope)) {
    throw new Error(`Missing required MCP scope: ${scope}`);
  }
}

export function isMcpEnabled(): boolean {
  return String(process.env.MCP_ENABLED || "").toLowerCase() === "true";
}
