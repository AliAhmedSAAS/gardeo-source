import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set. Mobile authentication is unavailable.");
  }
  return secret;
}

export function validateJwtConfig(): void {
  if (!process.env.JWT_SECRET) {
    console.warn("WARNING: JWT_SECRET is not set. Mobile authentication endpoints will not function.");
  }
}

function getClientMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
  const userAgent = (req.headers["user-agent"] as string) || null;
  return { ipAddress: ip || null, userAgent };
}

export function generateAccessToken(user: User): string {
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(user: User): string {
  return jwt.sign(
    { userId: user.id, type: "refresh" },
    getJwtSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

export async function jwtAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();

  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    if (!payload.userId || payload.type === "refresh") return next();

    const user = await storage.getUser(payload.userId);
    if (!user || !user.isActive) return next();

    (req as any).user = user;
    (req as any).jwtAuth = true;
  } catch {
  }
  next();
}

export function registerMobileAuthRoutes(app: any) {
  app.post("/api/auth/mobile/login", async (req: Request, res: Response) => {
    try {
      const { email, password, username, tenantId } = req.body;
      const identifier = email || username;

      if (!identifier || !password) {
        return res.status(400).json({ message: "Email/username and password are required" });
      }

      const isEmail = typeof identifier === "string" && identifier.includes("@");

      if (!tenantId) {
        const allUsers = isEmail
          ? await storage.getUsersByEmail(identifier.trim().toLowerCase())
          : await storage.getUsersByUsername(identifier);

        if (allUsers.length > 1) {
          const activeUsers = allUsers.filter(u => u.isActive !== false && u.password !== "NEEDS_ONBOARDING");
          let validUsers: typeof activeUsers = [];
          for (const u of activeUsers) {
            if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) continue;
            const valid = await bcrypt.compare(password, u.password);
            if (valid) validUsers.push(u);
          }
          if (validUsers.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
          }
          if (validUsers.length === 1) {
            const matchedUser = validUsers[0];
            if (matchedUser.failedLoginAttempts && matchedUser.failedLoginAttempts > 0) {
              await storage.updateUser(matchedUser.id, { failedLoginAttempts: 0, lockedUntil: null } as any);
            }
            await storage.updateUser(matchedUser.id, { lastLoginAt: new Date() });
            const meta = getClientMeta(req);
            if (matchedUser.tenantId != null) {
              await storage.createAuditLog({
                tenantId: matchedUser.tenantId, userId: matchedUser.id,
                action: "mobile_login", entityType: "user", entityId: matchedUser.id,
                details: { ipAddress: meta.ipAddress, userAgent: meta.userAgent, platform: "mobile" },
                ipAddress: meta.ipAddress,
              });
            }
            const accessToken = generateAccessToken(matchedUser);
            const refreshToken = generateRefreshToken(matchedUser);
            const { password: _, ...safeUser } = matchedUser;
            return res.json({ accessToken, refreshToken, expiresIn: 900, user: safeUser });
          }
          if (validUsers.length > 1) {
            const tenantOptions = [];
            for (const u of validUsers) {
              if (u.tenantId) {
                const tenant = await storage.getTenant(u.tenantId);
                tenantOptions.push({ tenantId: u.tenantId, tenantName: tenant?.name || "Unknown", userId: u.id });
              }
            }
            return res.json({ requiresTenantSelection: true, tenants: tenantOptions });
          }
        }
      }

      const user = isEmail
        ? (tenantId ? await storage.getUserByEmail(identifier.trim().toLowerCase(), tenantId) : await storage.getUserByEmail(identifier.trim().toLowerCase()))
        : (tenantId ? await storage.getUserByUsername(identifier, tenantId) : await storage.getUserByUsername(identifier));

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
        return res.status(401).json({
          message: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await storage.updateUser(user.id, { failedLoginAttempts: attempts, lockedUntil: lockout } as any);
        if (lockout) {
          return res.status(401).json({
            message: "Account locked due to too many failed attempts. Try again in 15 minutes.",
          });
        }
        return res.status(401).json({
          message: `Invalid credentials. ${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining.`,
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
        await storage.updateUser(user.id, { failedLoginAttempts: 0, lockedUntil: null } as any);
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      const meta = getClientMeta(req);
      if (user.tenantId != null) {
        await storage.createAuditLog({
          tenantId: user.tenantId,
          userId: user.id,
          action: "mobile_login",
          entityType: "user",
          entityId: user.id,
          details: { ipAddress: meta.ipAddress, userAgent: meta.userAgent, platform: "mobile" },
          ipAddress: meta.ipAddress,
        });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      const { password: _, ...safeUser } = user;

      res.json({
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: safeUser,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Login failed" });
    }
  });

  app.post("/api/auth/mobile/login/select-tenant", async (req: Request, res: Response) => {
    try {
      const { userId, password } = req.body;
      if (!userId || !password) {
        return res.status(400).json({ message: "User ID and password are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
        return res.status(401).json({
          message: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await storage.updateUser(user.id, { failedLoginAttempts: attempts, lockedUntil: lockout } as any);
        if (lockout) {
          return res.status(401).json({ message: "Account locked due to too many failed attempts. Try again in 15 minutes." });
        }
        return res.status(401).json({ message: `Invalid credentials. ${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining.` });
      }

      if (!user.isActive) return res.status(401).json({ message: "Account is deactivated" });

      await storage.updateUser(user.id, { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } as any);

      const meta = getClientMeta(req);
      if (user.tenantId != null) {
        await storage.createAuditLog({
          tenantId: user.tenantId,
          userId: user.id,
          action: "mobile_login",
          entityType: "user",
          entityId: user.id,
          details: { ipAddress: meta.ipAddress, userAgent: meta.userAgent, platform: "mobile", tenantSelection: true },
          ipAddress: meta.ipAddress,
        });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      const { password: _, ...safeUser } = user;

      res.json({ accessToken, refreshToken, expiresIn: 900, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Login failed" });
    }
  });

  app.post("/api/auth/mobile/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }

      let payload: jwt.JwtPayload;
      try {
        payload = verifyToken(refreshToken);
      } catch {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      if (payload.type !== "refresh" || !payload.userId) {
        return res.status(401).json({ message: "Invalid token type" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      const accessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Token refresh failed" });
    }
  });

  app.get("/api/auth/mobile/user", async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    try {
      const payload = verifyToken(token);
      if (!payload.userId || payload.type === "refresh") {
        return res.status(401).json({ message: "Invalid token" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      const { password: _, ...safeUser } = user;

      const employee = await storage.getEmployeeByUserId(user.id);
      const permissions = await storage.getRolePermissionsByRole(user.role);
      const enabledPermissions = permissions
        .filter((p: any) => p.enabled)
        .map((p: any) => p.permissionKey);

      res.json({
        ...safeUser,
        employeeId: employee?.id || null,
        permissions: enabledPermissions,
      });
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  });
}
