import type { Express, Request, RequestHandler, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { User } from "@shared/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  mcpApiKeys,
  mcpClients,
  mcpToolInvocations,
  MCP_SCOPES,
} from "@shared/schema";
import { authenticateMcpBearer, generateMcpApiKey } from "./auth";
import { isMcpEnabled } from "./context";
import { checkMcpRateLimit } from "./rate-limit";
import { createGardeoMcpServer } from "./tools";
import { confirmProposal, listProposals, rejectProposal } from "./proposals";
import { storage } from "../storage";

function clientIp(req: Request): string | null {
  const fwd = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
  return fwd || req.socket?.remoteAddress || null;
}

function paramId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(String(raw || ""), 10);
}

function requireTenant(req: Request, res: Response): number | null {
  const user = req.user as User | undefined;
  if (!user?.tenantId) {
    res.status(400).json({ message: "No tenant assigned" });
    return null;
  }
  return user.tenantId;
}

const MCP_ADMIN_ROLES = ["super_admin", "tenant_admin", "admin"] as const;

const createClientSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(MCP_SCOPES as unknown as [string, ...string[]])).optional(),
  label: z.string().max(120).optional(),
});

async function handleMcpHttp(req: Request, res: Response) {
  if (!isMcpEnabled()) {
    return res.status(503).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "MCP is disabled. Set MCP_ENABLED=true." },
      id: null,
    });
  }

  const ctx = await authenticateMcpBearer(req.headers.authorization, clientIp(req));
  if (!ctx) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized — valid Gardeo MCP API key required" },
      id: null,
    });
  }

  const rl = checkMcpRateLimit(`mcp:${ctx.apiKeyId}`);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({
      jsonrpc: "2.0",
      error: { code: -32002, message: "Rate limit exceeded" },
      id: null,
    });
  }

  const server = createGardeoMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (err: any) {
    console.error("[mcp] request error:", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
    void transport.close();
    void server.close();
  }
}

export function registerMcpRoutes(
  app: Express,
  requireRole: (...roles: string[]) => RequestHandler,
) {
  app.post("/mcp", async (req, res) => {
    await handleMcpHttp(req, res);
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST with Bearer token." },
      id: null,
    });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed (stateless MCP)." },
      id: null,
    });
  });

  app.get(
    "/api/admin/mcp/status",
    requireRole(...MCP_ADMIN_ROLES),
    async (_req, res) => {
      res.json({
        enabled: isMcpEnabled(),
        endpoint: "/mcp",
        scopes: MCP_SCOPES,
        phase: 3,
      });
    },
  );

  app.get(
    "/api/admin/mcp/clients",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;

        const clients = await db
          .select()
          .from(mcpClients)
          .where(eq(mcpClients.tenantId, tenantId))
          .orderBy(desc(mcpClients.createdAt));

        const keys = await db
          .select({
            id: mcpApiKeys.id,
            clientId: mcpApiKeys.clientId,
            keyPrefix: mcpApiKeys.keyPrefix,
            label: mcpApiKeys.label,
            expiresAt: mcpApiKeys.expiresAt,
            lastUsedAt: mcpApiKeys.lastUsedAt,
            revokedAt: mcpApiKeys.revokedAt,
            createdAt: mcpApiKeys.createdAt,
          })
          .from(mcpApiKeys)
          .where(eq(mcpApiKeys.tenantId, tenantId))
          .orderBy(desc(mcpApiKeys.createdAt));

        res.json({
          clients: clients.map((c) => ({
            ...c,
            keys: keys.filter((k) => k.clientId === c.id),
          })),
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/mcp/clients",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const parsed = createClientSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid body" });
        }

        const scopes = parsed.data.scopes?.length
          ? parsed.data.scopes
          : (["ops.read"] as string[]);

        const [client] = await db
          .insert(mcpClients)
          .values({
            tenantId,
            name: parsed.data.name.trim(),
            scopes,
            status: "active",
            createdByUserId: user.id,
          })
          .returning();

        const { rawKey, keyPrefix, keyHash } = generateMcpApiKey();
        const [key] = await db
          .insert(mcpApiKeys)
          .values({
            clientId: client.id,
            tenantId,
            keyPrefix,
            keyHash,
            label: parsed.data.label || "default",
            createdByUserId: user.id,
          })
          .returning();

        await storage.createAuditLog({
          tenantId,
          userId: user.id,
          action: "mcp_client_created",
          entityType: "mcp_client",
          entityId: String(client.id),
          details: { name: client.name, scopes, keyId: key.id, keyPrefix },
          ipAddress: clientIp(req),
        });

        res.status(201).json({
          client,
          key: {
            id: key.id,
            keyPrefix: key.keyPrefix,
            label: key.label,
            createdAt: key.createdAt,
          },
          // Shown once — store securely; not retrievable again.
          apiKey: rawKey,
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/mcp/clients/:id/keys",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const clientId = paramId(req.params.id);
        if (!Number.isFinite(clientId)) {
          return res.status(400).json({ message: "Invalid client id" });
        }

        const [client] = await db
          .select()
          .from(mcpClients)
          .where(and(eq(mcpClients.id, clientId), eq(mcpClients.tenantId, tenantId)))
          .limit(1);
        if (!client) return res.status(404).json({ message: "Client not found" });

        const label =
          typeof req.body?.label === "string" && req.body.label.trim()
            ? req.body.label.trim().slice(0, 120)
            : "rotated";

        const { rawKey, keyPrefix, keyHash } = generateMcpApiKey();
        const [key] = await db
          .insert(mcpApiKeys)
          .values({
            clientId: client.id,
            tenantId,
            keyPrefix,
            keyHash,
            label,
            createdByUserId: user.id,
          })
          .returning();

        await storage.createAuditLog({
          tenantId,
          userId: user.id,
          action: "mcp_key_created",
          entityType: "mcp_api_key",
          entityId: String(key.id),
          details: { clientId: client.id, keyPrefix, label },
          ipAddress: clientIp(req),
        });

        res.status(201).json({
          key: {
            id: key.id,
            keyPrefix: key.keyPrefix,
            label: key.label,
            createdAt: key.createdAt,
          },
          apiKey: rawKey,
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/mcp/keys/:id/revoke",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const keyId = paramId(req.params.id);
        if (!Number.isFinite(keyId)) {
          return res.status(400).json({ message: "Invalid key id" });
        }

        const [key] = await db
          .select()
          .from(mcpApiKeys)
          .where(
            and(
              eq(mcpApiKeys.id, keyId),
              eq(mcpApiKeys.tenantId, tenantId),
              isNull(mcpApiKeys.revokedAt),
            ),
          )
          .limit(1);
        if (!key) return res.status(404).json({ message: "Key not found" });

        const [updated] = await db
          .update(mcpApiKeys)
          .set({ revokedAt: new Date() })
          .where(eq(mcpApiKeys.id, key.id))
          .returning();

        await storage.createAuditLog({
          tenantId,
          userId: user.id,
          action: "mcp_key_revoked",
          entityType: "mcp_api_key",
          entityId: String(key.id),
          details: { clientId: key.clientId, keyPrefix: key.keyPrefix },
          ipAddress: clientIp(req),
        });

        res.json({ key: updated });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.patch(
    "/api/admin/mcp/clients/:id",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const clientId = paramId(req.params.id);
        if (!Number.isFinite(clientId)) {
          return res.status(400).json({ message: "Invalid client id" });
        }

        const status =
          req.body?.status === "active" || req.body?.status === "disabled"
            ? req.body.status
            : null;
        const name =
          typeof req.body?.name === "string" && req.body.name.trim()
            ? req.body.name.trim().slice(0, 120)
            : undefined;

        if (!status && name === undefined) {
          return res.status(400).json({ message: "Provide name and/or status" });
        }

        const [existing] = await db
          .select()
          .from(mcpClients)
          .where(and(eq(mcpClients.id, clientId), eq(mcpClients.tenantId, tenantId)))
          .limit(1);
        if (!existing) return res.status(404).json({ message: "Client not found" });

        const [updated] = await db
          .update(mcpClients)
          .set({
            ...(name !== undefined ? { name } : {}),
            ...(status ? { status } : {}),
            updatedAt: new Date(),
          })
          .where(eq(mcpClients.id, existing.id))
          .returning();

        await storage.createAuditLog({
          tenantId,
          userId: user.id,
          action: "mcp_client_updated",
          entityType: "mcp_client",
          entityId: String(existing.id),
          details: { name: updated.name, status: updated.status },
          ipAddress: clientIp(req),
        });

        res.json({ client: updated });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.get(
    "/api/admin/mcp/invocations",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);

        const rows = await db
          .select()
          .from(mcpToolInvocations)
          .where(eq(mcpToolInvocations.tenantId, tenantId))
          .orderBy(desc(mcpToolInvocations.createdAt))
          .limit(limit);

        res.json({ data: rows });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.get(
    "/api/admin/mcp/proposals",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const status = typeof req.query.status === "string" ? req.query.status : "pending";
        const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
        const data = await listProposals(tenantId, {
          status: status === "all" ? undefined : status,
          limit,
        });
        res.json({ data });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/mcp/proposals/:id/confirm",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const proposalId = paramId(req.params.id);
        if (!Number.isFinite(proposalId)) {
          return res.status(400).json({ message: "Invalid proposal id" });
        }
        const { proposal, result } = await confirmProposal({
          tenantId,
          proposalId,
          requireToken: false,
          confirmedByUserId: user.id,
          ipAddress: clientIp(req),
        });
        res.json({ proposal, result });
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    },
  );

  app.post(
    "/api/admin/mcp/proposals/:id/reject",
    requireRole(...MCP_ADMIN_ROLES),
    async (req, res) => {
      try {
        if (!isMcpEnabled()) {
          return res.status(503).json({ message: "MCP is disabled. Set MCP_ENABLED=true." });
        }
        const tenantId = requireTenant(req, res);
        if (tenantId == null) return;
        const user = req.user as User;
        const proposalId = paramId(req.params.id);
        if (!Number.isFinite(proposalId)) {
          return res.status(400).json({ message: "Invalid proposal id" });
        }
        const proposal = await rejectProposal({
          tenantId,
          proposalId,
          requireToken: false,
          rejectedByUserId: user.id,
          ipAddress: clientIp(req),
        });
        res.json({ proposal });
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    },
  );
}
