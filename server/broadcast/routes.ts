import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import type { User } from "@shared/schema";
import { storage } from "../storage";
import { sendRouteError } from "../route-errors";
import { isTwilioConfigured } from "../twilio-service";
import { geocodePendingEmployees, lookupPostcode, normalizePostcode, resolveSiteCenter, type LatLng } from "./geocode";
import { searchOfficers } from "./officers";
import { buildShiftMessage, loadSite, searchSites } from "./message";
import { createBroadcast, getBroadcastStatus, hasActiveBroadcast, processBroadcast } from "./sender";

const BROADCAST_ROLES = [
  "super_admin",
  "tenant_admin",
  "ceo",
  "operations_manager",
  "regional_manager",
  "admin",
  "controller",
  "scheduler",
  "hr_manager",
] as const;

const RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;
const MAX_RECIPIENTS = 500;
const SMS_MAX_LENGTH = 1600;

const searchSchema = z.object({
  siteId: z.number().int().positive().optional(),
  postcode: z.string().trim().max(10).optional(),
  radiusMiles: z.number().refine((v) => (RADIUS_OPTIONS as readonly number[]).includes(v), "Invalid radius"),
  filter: z.enum(["all", "previously_worked", "car_owner", "new"]).default("all"),
  officerType: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
}).refine((v) => v.siteId || v.postcode, { message: "Select a site or enter a postcode" });

const sendSchema = z.object({
  channel: z.enum(["email", "sms"]),
  employeeIds: z.array(z.number().int().positive()).min(1).max(MAX_RECIPIENTS),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(5000),
  shiftId: z.number().int().positive().optional(),
  siteId: z.number().int().positive().optional(),
}).superRefine((v, ctx) => {
  if (v.channel === "email" && !v.subject) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subject"], message: "Subject is required for email" });
  }
  if (v.channel === "sms" && v.body.length > SMS_MAX_LENGTH) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: `SMS must be ${SMS_MAX_LENGTH} characters or fewer` });
  }
});

function requireTenant(req: Request, res: Response): { tenantId: number; userId: string } | null {
  const user = req.user as User | undefined;
  if (!user?.tenantId) {
    res.status(400).json({ message: "No tenant assigned" });
    return null;
  }
  return { tenantId: user.tenantId, userId: user.id };
}

function validationError(res: Response, err: z.ZodError) {
  return res.status(422).json({ message: err.issues[0]?.message || "Invalid request", errors: err.flatten() });
}

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function registerBroadcastRoutes(app: Express, requireRole: (...roles: string[]) => RequestHandler) {
  const guard = requireRole(...BROADCAST_ROLES);

  app.get("/api/broadcast/config", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    try {
      const email = await storage.getTenantEmailSettings(ctx.tenantId);
      res.json({
        emailEnabled: !!(email?.enabled && email.fromEmail),
        emailFrom: email?.fromEmail ? `${email.fromName || ""} <${email.fromEmail}>`.trim() : null,
        smsEnabled: isTwilioConfigured(),
        radiusOptions: RADIUS_OPTIONS,
        maxRecipients: MAX_RECIPIENTS,
      });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.get("/api/broadcast/sites", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json([]);
    try {
      res.json(await searchSites(ctx.tenantId, q.slice(0, 100)));
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.get("/api/broadcast/shift/:id/message", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    const shiftId = parseId(req.params.id);
    if (!shiftId) return res.status(400).json({ message: "Invalid shift id" });
    const scope = req.query.scope === "all" ? "all" : "single";
    try {
      const result = await buildShiftMessage(ctx.tenantId, shiftId, scope);
      if (!result) return res.status(404).json({ message: "Shift not found or has no site" });
      res.json(result);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post("/api/broadcast/officers/search", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    const input = parsed.data;

    try {
      let center: (LatLng & { source: string; postcode: string | null }) | null = null;
      if (input.postcode) {
        const postcode = normalizePostcode(input.postcode);
        if (!postcode) return res.status(422).json({ message: "Enter a valid UK postcode" });
        const point = await lookupPostcode(postcode);
        if (!point) return res.status(422).json({ message: `Postcode ${postcode} was not found` });
        center = { ...point, source: "postcode", postcode };
      } else if (input.siteId) {
        const site = await loadSite(ctx.tenantId, input.siteId);
        if (!site) return res.status(404).json({ message: "Site not found" });
        center = await resolveSiteCenter(site);
        if (!center) {
          return res.status(422).json({ message: "This site has no coordinates or postcode. Enter a postcode to search." });
        }
      }
      if (!center) return res.status(422).json({ message: "Select a site or enter a postcode" });

      const geocode = await geocodePendingEmployees(ctx.tenantId);
      const { officers, truncated } = await searchOfficers({
        tenantId: ctx.tenantId,
        center,
        radiusMiles: input.radiusMiles,
        siteId: input.siteId ?? null,
        filter: input.filter,
        officerType: input.officerType || null,
        name: input.name || null,
      });
      res.json({ center, officers, truncated, geocodePending: geocode.remaining });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post("/api/broadcast/send", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    const input = parsed.data;

    try {
      if (input.channel === "email") {
        const email = await storage.getTenantEmailSettings(ctx.tenantId);
        if (!email?.enabled || !email.fromEmail) {
          return res.status(422).json({ message: "Email is not configured. Enable it in Settings → Email / SMTP." });
        }
      } else if (!isTwilioConfigured()) {
        return res.status(422).json({ message: "SMS is not configured (Twilio credentials missing)." });
      }
      if (await hasActiveBroadcast(ctx.tenantId)) {
        return res.status(409).json({ message: "Another broadcast is still sending. Please wait for it to finish." });
      }

      const created = await createBroadcast({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        channel: input.channel,
        subject: input.channel === "email" ? input.subject ?? null : null,
        body: input.body,
        employeeIds: Array.from(new Set(input.employeeIds)),
        shiftId: input.shiftId ?? null,
        siteId: input.siteId ?? null,
      });
      if (created.queued === 0) {
        await processBroadcast(created.id, ctx.tenantId);
        return res.status(422).json({
          message: `None of the selected officers have a valid ${input.channel === "email" ? "email address" : "mobile number"}.`,
          id: created.id,
        });
      }

      processBroadcast(created.id, ctx.tenantId).catch((err) => {
        console.error(`[broadcast] id=${created.id} tenant=${ctx.tenantId} failed:`, err?.message);
      });
      res.status(202).json({ id: created.id, queued: created.queued, skipped: created.skipped });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.get("/api/broadcast/:id", guard, async (req, res) => {
    const ctx = requireTenant(req, res);
    if (!ctx) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid broadcast id" });
    try {
      const status = await getBroadcastStatus(ctx.tenantId, id);
      if (!status) return res.status(404).json({ message: "Broadcast not found" });
      res.json(status);
    } catch (err) {
      sendRouteError(res, err);
    }
  });
}
