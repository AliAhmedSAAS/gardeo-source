import { db } from "../db";
import { mcpToolInvocations, type InsertMcpToolInvocation } from "@shared/schema";
import { storage } from "../storage";
import type { McpAuthContext } from "./context";
import { fingerprintArgs } from "./sanitize";

export async function recordMcpInvocation(
  ctx: McpAuthContext,
  toolName: string,
  args: unknown,
  result: { success: boolean; errorMessage?: string; latencyMs: number },
): Promise<void> {
  const row: InsertMcpToolInvocation = {
    tenantId: ctx.tenantId,
    clientId: ctx.clientId,
    apiKeyId: ctx.apiKeyId,
    toolName,
    argsFingerprint: fingerprintArgs(args),
    success: result.success,
    errorMessage: result.errorMessage?.slice(0, 500) ?? null,
    latencyMs: result.latencyMs,
    ipAddress: ctx.ipAddress,
  };

  try {
    await db.insert(mcpToolInvocations).values(row);
  } catch (err: any) {
    console.error("[mcp] failed to write invocation log:", err?.message || err);
  }

  try {
    await storage.createAuditLog({
      tenantId: ctx.tenantId,
      action: result.success ? "mcp_tool_success" : "mcp_tool_error",
      entityType: "mcp_tool",
      entityId: String(ctx.clientId),
      details: {
        toolName,
        clientId: ctx.clientId,
        apiKeyId: ctx.apiKeyId,
        argsFingerprint: row.argsFingerprint,
        success: result.success,
        latencyMs: result.latencyMs,
      },
      ipAddress: ctx.ipAddress ?? undefined,
    });
  } catch (err: any) {
    console.error("[mcp] failed to write audit log:", err?.message || err);
  }
}
