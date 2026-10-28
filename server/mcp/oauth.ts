import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  mcpOauthCodes,
  mcpOauthRefreshTokens,
  MCP_SCOPES,
  type McpScope,
  type User,
} from "@shared/schema";
import { storage } from "../storage";
import type { McpAuthContext } from "./context";
import { isMcpEnabled } from "./context";
import { renderConsentPage, renderErrorPage } from "./oauth-consent";

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CIMD_CACHE = new Map<string, { doc: CimdDocument; expiresAt: number }>();

type CimdDocument = {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
};

function getIssuer(): string {
  const fromEnv =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";
  if (fromEnv.trim()) return fromEnv.trim().replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

export function getMcpResourceUrl(): string {
  return `${getIssuer()}/mcp`;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("JWT_SECRET (or SESSION_SECRET) is required for MCP OAuth");
  return secret;
}

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function normalizeScopes(scope: string | undefined | null): McpScope[] {
  const allowed = new Set<string>(MCP_SCOPES);
  const parts = String(scope || "ops.read")
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => allowed.has(s)) as McpScope[];
  return parts.length > 0 ? parts : (["ops.read"] as McpScope[]);
}

function redirectUriAllowed(requested: string, allowed: string[]): boolean {
  if (allowed.includes(requested)) return true;
  try {
    const reqUrl = new URL(requested);
    const isLoopback =
      reqUrl.hostname === "localhost" ||
      reqUrl.hostname === "127.0.0.1" ||
      reqUrl.hostname === "[::1]";
    if (!isLoopback) return false;
    return allowed.some((a) => {
      try {
        const u = new URL(a);
        const aLoop =
          u.hostname === "localhost" ||
          u.hostname === "127.0.0.1" ||
          u.hostname === "[::1]";
        if (!aLoop) return false;
        return u.protocol === reqUrl.protocol && u.pathname === reqUrl.pathname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function resolveCimdClient(clientId: string): Promise<CimdDocument> {
  if (!/^https:\/\//i.test(clientId)) {
    throw new Error("client_id must be an HTTPS Client ID Metadata Document URL");
  }
  const cached = CIMD_CACHE.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(clientId, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to fetch client metadata (${res.status})`);
    const doc = (await res.json()) as CimdDocument;
    if (!doc || doc.client_id !== clientId) {
      throw new Error("CIMD client_id mismatch");
    }
    if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) {
      throw new Error("CIMD missing redirect_uris");
    }
    const method = doc.token_endpoint_auth_method || "none";
    if (method !== "none") {
      throw new Error("Only public CIMD clients (token_endpoint_auth_method=none) are supported");
    }
    CIMD_CACHE.set(clientId, { doc, expiresAt: Date.now() + 5 * 60 * 1000 });
    return doc;
  } finally {
    clearTimeout(timer);
  }
}

export function oauthProtectedResourceMetadata() {
  const issuer = getIssuer();
  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [issuer],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
  };
}

export function oauthAuthorizationServerMetadata() {
  const issuer = getIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...MCP_SCOPES],
    client_id_metadata_document_supported: true,
  };
}

export function mcpWwwAuthenticateHeader(): string {
  const meta = `${getIssuer()}/.well-known/oauth-protected-resource/mcp`;
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${meta}", scope="ops.read ops.write"`;
}

function issueAccessToken(opts: {
  userId: string;
  tenantId: number;
  scopes: McpScope[];
  clientId: string;
}): string {
  return jwt.sign(
    {
      typ: "mcp_oauth",
      sub: opts.userId,
      userId: opts.userId,
      tenantId: opts.tenantId,
      scopes: opts.scopes,
      clientId: opts.clientId,
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TTL_SEC },
  );
}

async function issueRefreshToken(opts: {
  userId: string;
  tenantId: number;
  scopes: McpScope[];
  clientId: string;
}): Promise<string> {
  const raw = `mcp_rt_${crypto.randomBytes(32).toString("hex")}`;
  await db.insert(mcpOauthRefreshTokens).values({
    tokenHash: hashToken(raw),
    clientId: opts.clientId,
    userId: opts.userId,
    tenantId: opts.tenantId,
    scopes: opts.scopes,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return raw;
}

export async function authenticateMcpOauthBearer(
  authorization: string | undefined,
  ipAddress: string | null,
): Promise<McpAuthContext | null> {
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.startsWith("gdeo_mcp_")) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    if (payload.typ !== "mcp_oauth" || !payload.userId || !payload.tenantId) return null;
    const user = await storage.getUser(String(payload.userId));
    if (!user || !user.isActive || user.tenantId !== payload.tenantId) return null;

    return {
      tenantId: Number(payload.tenantId),
      clientId: null,
      clientName: String(payload.clientId || "oauth"),
      apiKeyId: null,
      userId: user.id,
      authType: "oauth",
      scopes: normalizeScopes(
        Array.isArray(payload.scopes) ? payload.scopes.join(" ") : String(payload.scope || "ops.read"),
      ),
      ipAddress,
    };
  } catch {
    return null;
  }
}

function currentUser(req: Request): User | null {
  if (req.isAuthenticated && req.isAuthenticated() && (req as any).user) {
    return (req as any).user as User;
  }
  return null;
}

async function loginWithPassword(identifier: string, password: string): Promise<User | null> {
  const id = identifier.trim();
  if (!id || !password) return null;
  const isEmail = id.includes("@");
  const candidates = isEmail
    ? await storage.getUsersByEmail(id.toLowerCase())
    : await storage.getUsersByUsername(id);
  for (const u of candidates) {
    if (!u.isActive || u.password === "NEEDS_ONBOARDING") continue;
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) continue;
    const ok = await bcrypt.compare(password, u.password);
    if (ok) return u;
  }
  return null;
}

export function registerMcpOauthRoutes(app: Express) {
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(oauthProtectedResourceMetadata());
  });
  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    res.json(oauthProtectedResourceMetadata());
  });
  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json(oauthAuthorizationServerMetadata());
  });
  // Some clients look under the path prefix.
  app.get("/.well-known/oauth-authorization-server/mcp", (_req, res) => {
    res.json(oauthAuthorizationServerMetadata());
  });

  app.get("/oauth/authorize", async (req, res) => {
    try {
      if (!isMcpEnabled()) {
        return res.status(503).send(renderErrorPage("MCP is disabled on this server."));
      }
      await handleAuthorizeGet(req, res);
    } catch (err: any) {
      res.status(400).send(renderErrorPage(err?.message || "Authorization failed"));
    }
  });

  app.post("/oauth/authorize", async (req, res) => {
    try {
      if (!isMcpEnabled()) {
        return res.status(503).send(renderErrorPage("MCP is disabled on this server."));
      }
      await handleAuthorizePost(req, res);
    } catch (err: any) {
      res.status(400).send(renderErrorPage(err?.message || "Authorization failed"));
    }
  });

  app.post("/oauth/token", async (req, res) => {
    try {
      if (!isMcpEnabled()) {
        return res.status(503).json({ error: "temporarily_unavailable", error_description: "MCP disabled" });
      }
      await handleToken(req, res);
    } catch (err: any) {
      res.status(400).json({
        error: "invalid_request",
        error_description: err?.message || "Token request failed",
      });
    }
  });

  app.post("/oauth/revoke", async (req, res) => {
    try {
      const token = String(req.body?.token || "");
      if (token) {
        await db
          .update(mcpOauthRefreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(mcpOauthRefreshTokens.tokenHash, hashToken(token)));
      }
      res.status(200).json({});
    } catch {
      res.status(200).json({});
    }
  });
}

async function handleAuthorizeGet(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const clientId = String(q.client_id || "");
  const redirectUri = String(q.redirect_uri || "");
  const responseType = String(q.response_type || "");
  const codeChallenge = String(q.code_challenge || "");
  const codeChallengeMethod = String(q.code_challenge_method || "S256");
  const state = q.state ? String(q.state) : "";
  const scope = String(q.scope || "ops.read ops.write");
  const resource = q.resource ? String(q.resource) : getMcpResourceUrl();

  if (responseType !== "code") throw new Error("response_type must be code");
  if (!clientId || !redirectUri || !codeChallenge) {
    throw new Error("client_id, redirect_uri, and code_challenge are required");
  }
  if (codeChallengeMethod !== "S256") throw new Error("Only S256 PKCE is supported");

  const cimd = await resolveCimdClient(clientId);
  if (!redirectUriAllowed(redirectUri, cimd.redirect_uris)) {
    throw new Error("redirect_uri is not registered for this client");
  }
  if (resource && resource !== getMcpResourceUrl()) {
    // Soft-check: prefer exact MCP resource URL
    console.warn("[mcp-oauth] resource mismatch:", resource, "expected", getMcpResourceUrl());
  }

  const user = currentUser(req);
  const clientHost = (() => {
    try {
      return new URL(clientId).host;
    } catch {
      return clientId;
    }
  })();

  res
    .status(200)
    .type("html")
    .send(
      renderConsentPage({
        clientHost,
        redirectUri,
        scope,
        loggedIn: !!user,
        userLabel: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : null,
        formAction: "/oauth/authorize",
        hidden: {
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: responseType,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          state,
          scope,
          resource,
        },
      }),
    );
}

async function handleAuthorizePost(req: Request, res: Response) {
  const body = req.body || {};
  const action = String(body.action || "approve");
  const clientId = String(body.client_id || "");
  const redirectUri = String(body.redirect_uri || "");
  const codeChallenge = String(body.code_challenge || "");
  const codeChallengeMethod = String(body.code_challenge_method || "S256");
  const state = body.state ? String(body.state) : "";
  const scope = String(body.scope || "ops.read");
  const resource = body.resource ? String(body.resource) : getMcpResourceUrl();

  const cimd = await resolveCimdClient(clientId);
  if (!redirectUriAllowed(redirectUri, cimd.redirect_uris)) {
    throw new Error("redirect_uri is not registered for this client");
  }

  if (action === "deny") {
    const u = new URL(redirectUri);
    u.searchParams.set("error", "access_denied");
    if (state) u.searchParams.set("state", state);
    return res.redirect(u.toString());
  }

  let user = currentUser(req);
  if (!user) {
    const identifier = String(body.username || body.email || "");
    const password = String(body.password || "");
    user = await loginWithPassword(identifier, password);
    if (!user) {
      return res.status(401).type("html").send(
        renderConsentPage({
          clientHost: new URL(clientId).host,
          redirectUri,
          scope,
          loggedIn: false,
          userLabel: null,
          error: "Invalid email/username or password",
          formAction: "/oauth/authorize",
          hidden: {
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            state,
            scope,
            resource,
          },
        }),
      );
    }
    // Establish session for convenience on subsequent consents.
    await new Promise<void>((resolve, reject) => {
      (req as any).login(user, (err: any) => (err ? reject(err) : resolve()));
    }).catch(() => undefined);
  }

  if (!user.tenantId) throw new Error("User has no tenant assigned");
  if (!["super_admin", "tenant_admin", "admin", "ceo", "operations_manager", "controller", "scheduler"].includes(user.role)) {
    // Allow broader ops roles for MCP consent; employees/suppliers blocked.
    const allowed = new Set([
      "super_admin",
      "tenant_admin",
      "admin",
      "ceo",
      "operations_manager",
      "regional_manager",
      "controller",
      "scheduler",
      "hr_manager",
      "compliance_manager",
    ]);
    if (!allowed.has(user.role)) {
      throw new Error("Your role is not allowed to authorize MCP access");
    }
  }

  const scopes = normalizeScopes(scope);
  const rawCode = `mcp_code_${crypto.randomBytes(24).toString("hex")}`;
  await db.insert(mcpOauthCodes).values({
    codeHash: hashToken(rawCode),
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope: scopes.join(" "),
    resource,
    userId: user.id,
    tenantId: user.tenantId,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const u = new URL(redirectUri);
  u.searchParams.set("code", rawCode);
  if (state) u.searchParams.set("state", state);
  return res.redirect(u.toString());
}

async function handleToken(req: Request, res: Response) {
  const body = req.body || {};
  const grantType = String(body.grant_type || "");

  if (grantType === "authorization_code") {
    const code = String(body.code || "");
    const redirectUri = String(body.redirect_uri || "");
    const clientId = String(body.client_id || "");
    const codeVerifier = String(body.code_verifier || "");
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing token parameters" });
    }

    const [row] = await db
      .select()
      .from(mcpOauthCodes)
      .where(and(eq(mcpOauthCodes.codeHash, hashToken(code)), isNull(mcpOauthCodes.usedAt)))
      .limit(1);
    if (!row) return res.status(400).json({ error: "invalid_grant", error_description: "Invalid code" });
    if (new Date(row.expiresAt) < new Date()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });
    }
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code/client mismatch" });
    }
    const expected = sha256Base64Url(codeVerifier);
    if (expected !== row.codeChallenge) {
      return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
    }

    await db
      .update(mcpOauthCodes)
      .set({ usedAt: new Date() })
      .where(eq(mcpOauthCodes.id, row.id));

    const scopes = normalizeScopes(row.scope);
    const accessToken = issueAccessToken({
      userId: row.userId,
      tenantId: row.tenantId,
      scopes,
      clientId: row.clientId,
    });
    const refreshToken = await issueRefreshToken({
      userId: row.userId,
      tenantId: row.tenantId,
      scopes,
      clientId: row.clientId,
    });

    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SEC,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(body.refresh_token || "");
    const clientId = String(body.client_id || "");
    if (!refreshToken || !clientId) {
      return res.status(400).json({ error: "invalid_request" });
    }
    const [row] = await db
      .select()
      .from(mcpOauthRefreshTokens)
      .where(
        and(
          eq(mcpOauthRefreshTokens.tokenHash, hashToken(refreshToken)),
          isNull(mcpOauthRefreshTokens.revokedAt),
        ),
      )
      .limit(1);
    if (!row || row.clientId !== clientId) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (new Date(row.expiresAt) < new Date()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Refresh token expired" });
    }

    const scopes = normalizeScopes(row.scopes?.join(" "));
    const accessToken = issueAccessToken({
      userId: row.userId,
      tenantId: row.tenantId,
      scopes,
      clientId: row.clientId,
    });

    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SEC,
      scope: scopes.join(" "),
    });
  }

  return res.status(400).json({ error: "unsupported_grant_type" });
}
