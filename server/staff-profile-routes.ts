import type { Express, Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";
import { staffProfileStorage } from "./staff-profile-storage";
import { verifySiaLicence } from "./sia-check-service";
import {
  createEmployeeVettingFormToken,
  getVettingFormByToken,
  saveVettingFormByToken,
  submitVettingFormByToken,
} from "./employee-vetting-form-service";

type RequireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;

const HR_ROLES = [
  "super_admin",
  "tenant_admin",
  "ceo",
  "operations_manager",
  "regional_manager",
  "admin",
  "hr_manager",
  "compliance_manager",
  "training_manager",
] as const;

function paramId(value: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(raw, 10);
}

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

async function loadEmployeeScoped(req: Request, res: Response) {
  const user = req.user as User;
  const employeeId = paramId(req.params.id);
  if (Number.isNaN(employeeId)) {
    res.status(400).json({ message: "Invalid employee id" });
    return null;
  }
  const employee = await storage.getEmployee(employeeId);
  if (!employee) {
    res.status(404).json({ message: "Employee not found" });
    return null;
  }
  if (user.role !== "super_admin" && user.tenantId != null && employee.tenantId !== user.tenantId) {
    res.status(404).json({ message: "Employee not found" });
    return null;
  }
  return { user, employee, employeeId };
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function registerStaffProfileRoutes(app: Express, requireRole: RequireRole) {
  const guard = requireRole(...HR_ROLES);

  app.post("/api/admin/employees/:id/notes", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const body = String(req.body.body || "").trim();
      if (!body) return res.status(400).json({ message: "Note body required" });
      const note = await staffProfileStorage.createNote({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        body,
        createdBy: ctx.user.id,
      });
      res.status(201).json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/notes/:noteId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteNote(paramId(req.params.noteId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/preferred-sites", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const siteId = parseInt(req.body.siteId);
      if (!siteId) return res.status(400).json({ message: "siteId required" });
      const preferenceType = req.body.preferenceType === "banned" ? "banned" : "preferred";
      const row = await staffProfileStorage.createPreferredSite({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        siteId,
        preferenceType,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/preferred-sites/:rowId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deletePreferredSite(paramId(req.params.rowId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/education", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const institution = String(req.body.institution || "").trim();
      if (!institution) return res.status(400).json({ message: "institution required" });
      const row = await staffProfileStorage.createEducation({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        institution,
        qualification: req.body.qualification || null,
        dateFrom: req.body.dateFrom || null,
        dateTo: req.body.dateTo || null,
        notes: req.body.notes || null,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/employees/:id/education/:eduId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const row = await staffProfileStorage.updateEducation(paramId(req.params.eduId), ctx.employeeId, {
        institution: req.body.institution,
        qualification: req.body.qualification,
        dateFrom: req.body.dateFrom,
        dateTo: req.body.dateTo,
        notes: req.body.notes,
      });
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/education/:eduId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteEducation(paramId(req.params.eduId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/driving-licences", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const row = await staffProfileStorage.createDrivingLicence({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        licenceNumber: req.body.licenceNumber || null,
        categories: req.body.categories || null,
        issueDate: req.body.issueDate || null,
        expiryDate: req.body.expiryDate || null,
        notes: req.body.notes || null,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/driving-licences/:licId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteDrivingLicence(paramId(req.params.licId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/employees/:id/health", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const {
        height, weight, colourOfEyes,
        heartProblems, eyeProblems, earProblems, backProblems, chestProblems,
        asthma, depression, skinRashes, diabetes, beenIll, arthritis, cough,
        currentIllness, colorBlind, smoke, jaundice, migraine, seriouslyInjured,
        disability, nerve, tendons, rheumaticFever, rupture, nasalProblems, highBloodPressure,
      } = req.body;
      const row = await staffProfileStorage.upsertHealth(ctx.employeeId, ctx.employee.tenantId, {
        height, weight, colourOfEyes,
        heartProblems, eyeProblems, earProblems, backProblems, chestProblems,
        asthma, depression, skinRashes, diabetes, beenIll, arthritis, cough,
        currentIllness, colorBlind, smoke, jaundice, migraine, seriouslyInjured,
        disability, nerve, tendons, rheumaticFever, rupture, nasalProblems, highBloodPressure,
      });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/certificates", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "name required" });
      const row = await staffProfileStorage.createCertificate({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        name,
        issuer: req.body.issuer || null,
        issueDate: req.body.issueDate || null,
        expiryDate: req.body.expiryDate || null,
        fileUrl: req.body.fileUrl || null,
        notes: req.body.notes || null,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/certificates/:certId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteCertificate(paramId(req.params.certId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/sia-licences", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const siaNumber = String(req.body.siaNumber || "").trim();
      if (!siaNumber) return res.status(400).json({ message: "siaNumber required" });
      const row = await staffProfileStorage.createSiaLicence({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        siaNumber,
        expiryDate: req.body.expiryDate || null,
        licenceSector: req.body.licenceSector || null,
        isDefault: !!req.body.isDefault,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/sia-licences/:siaId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteSiaLicence(paramId(req.params.siaId), ctx.employeeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/sia/verify", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;

      const licenceInput = String(req.body.licenceNumber || ctx.employee.siaLicenseNumber || "").trim();
      if (!licenceInput) {
        return res.status(400).json({ message: "SIA licence number is required" });
      }

      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName = `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim();

      const result = await verifySiaLicence(licenceInput, { employeeName: employeeName || undefined });
      const updateEmployee = req.body.updateEmployee !== false;

      if (updateEmployee) {
        const empUpdate: Record<string, unknown> = {
          siaLastVerifiedAt: new Date(),
          siaRegisterStatus: result.status,
          siaRegisterHolderName: result.holderName,
          siaLicenseNumber: result.licenceNumber,
        };
        if (result.licenceSector) empUpdate.siaLicenseType = result.licenceSector;
        if (result.expiryDate) empUpdate.siaExpiryDate = result.expiryDate;
        await storage.updateEmployee(ctx.employeeId, empUpdate as any);
      }

      const auditDetails = [
        result.message,
        result.holderName ? `Register: ${result.holderName}` : null,
        result.licenceSector ? `Sector: ${result.licenceSector}` : null,
        result.expiryDate ? `Expiry: ${result.expiryDate}` : null,
      ].filter(Boolean).join(" · ");

      await staffProfileStorage.addVettingAudit({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        code: "SI",
        action: result.valid ? "SIA register verified" : "SIA register check failed",
        details: auditDetails,
        colorKey: "si",
        createdBy: ctx.user.id,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/right-of-work-checks", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const now = new Date();
      const row = await staffProfileStorage.createRightOfWorkCheck({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        lastUploadAt: req.body.lastUploadAt ? new Date(req.body.lastUploadAt) : now,
        nextReviewAt: req.body.nextReviewAt ? new Date(req.body.nextReviewAt) : addMonths(now, 6),
        status: req.body.status || "valid",
        notes: req.body.notes || null,
        documentId: req.body.documentId ? parseInt(req.body.documentId) : null,
        createdBy: ctx.user.id,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/employees/:id/right-of-work-checks/:checkId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const data: Record<string, any> = {};
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.notes !== undefined) data.notes = req.body.notes;
      if (req.body.lastUploadAt !== undefined) data.lastUploadAt = new Date(req.body.lastUploadAt);
      if (req.body.nextReviewAt !== undefined) data.nextReviewAt = new Date(req.body.nextReviewAt);
      if (req.body.documentId !== undefined) data.documentId = req.body.documentId ? parseInt(req.body.documentId) : null;
      const row = await staffProfileStorage.updateRightOfWorkCheck(paramId(req.params.checkId), ctx.employeeId, data);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/vetting-audit", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const code = String(req.body.code || "").trim().toUpperCase();
      const action = String(req.body.action || "").trim();
      const details = req.body.details != null ? String(req.body.details).trim() : "";
      if (!code || !action) {
        return res.status(400).json({ message: "Code and action are required" });
      }
      const allowed = new Set(["AR", "CV", "VC", "SI", "CL", "CR", "SDR", "VE", "DR", "WR"]);
      if (!allowed.has(code)) {
        return res.status(400).json({ message: "Invalid audit code" });
      }
      const row = await staffProfileStorage.addVettingAudit({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        code,
        action,
        details: details || null,
        colorKey: code.toLowerCase(),
        createdBy: ctx.user.id,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/p-form/unlock", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const row = await staffProfileStorage.unlockPForm(ctx.employeeId, ctx.employee.tenantId, ctx.user.id);
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/p-form/finish", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const row = await staffProfileStorage.finishPForm(ctx.employeeId, ctx.employee.tenantId, ctx.user.id);
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/references", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const refereeName = String(req.body.refereeName || "").trim();
      const company = String(req.body.company || "").trim() || "N/A";
      if (!refereeName) return res.status(400).json({ message: "refereeName required" });
      const row = await staffProfileStorage.createReference({
        employeeId: ctx.employeeId,
        refereeName,
        company,
        refereeEmail: req.body.refereeEmail || null,
        refereePhone: req.body.refereePhone || null,
        jobTitle: req.body.jobTitle || null,
        relationship: req.body.relationship || null,
        howLongKnown: req.body.howLongKnown || null,
        refereeAddress: req.body.refereeAddress || null,
        refereePostcode: req.body.refereePostcode || null,
        referenceKind: req.body.referenceKind || "personal",
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/employees/:id/references/:refId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const refereeName = String(req.body.refereeName || "").trim();
      if (!refereeName) return res.status(400).json({ message: "refereeName required" });
      const row = await staffProfileStorage.updateReference(paramId(req.params.refId), {
        refereeName,
        company: String(req.body.company || "").trim() || "N/A",
        refereeEmail: req.body.refereeEmail || null,
        refereePhone: req.body.refereePhone || null,
        jobTitle: req.body.jobTitle || null,
        relationship: req.body.relationship || null,
        howLongKnown: req.body.howLongKnown || null,
        refereeAddress: req.body.refereeAddress || null,
        refereePostcode: req.body.refereePostcode || null,
      });
      if (!row) return res.status(404).json({ message: "Reference record not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/references/:refId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteReference(paramId(req.params.refId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/references/:refId/verbal-enquiry", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const updated = await staffProfileStorage.recordPersonalReferenceVerbalEnquiry(
        paramId(req.params.refId),
        ctx.employeeId,
        ctx.employee.tenantId,
        ctx.user.id,
        {
          screeningComments: req.body.screeningComments || null,
          confirmedVerbally: !!req.body.confirmedVerbally,
        },
      );
      if (!updated) return res.status(404).json({ message: "Reference record not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/references/:refId/send-verification", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;
      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      const result = await staffProfileStorage.sendPersonalReferenceVerification(
        paramId(req.params.refId),
        ctx.employeeId,
        ctx.employee.tenantId,
        ctx.user.id,
        employeeName,
        tenant
          ? {
              companyName: tenant.name,
              tradingName: tenant.tradingName,
              email: tenant.email,
            }
          : undefined,
        typeof req.body?.refereeEmail === "string" ? req.body.refereeEmail : null,
      );
      if (!result.ok) return res.status(400).json({ message: result.error });
      res.json(result.record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/employees/:id/references/:refId/reference-pdf", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const refId = paramId(req.params.refId);
      const { getSubmittedPersonalReferenceToken, buildPersonalReferenceConfirmationPdf } = await import("./personal-reference-verify");
      const tokenRow = await getSubmittedPersonalReferenceToken(refId);
      if (!tokenRow || tokenRow.employeeId !== ctx.employeeId) {
        return res.status(404).json({ message: "No submitted reference confirmation found for this referee" });
      }
      const refRows = await storage.getReferences(ctx.employeeId);
      const ref = refRows.find((r) => r.id === refId);
      if (!ref) return res.status(404).json({ message: "Reference record not found" });

      const pdf = await buildPersonalReferenceConfirmationPdf(tokenRow, ref);
      if (!pdf) return res.status(404).json({ message: "Confirmation PDF is not available for this reference" });

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      });
      res.send(pdf.buffer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/references/send-all-verifications", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;
      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      const tenantInfo = tenant
        ? {
            companyName: tenant.name,
            tradingName: tenant.tradingName,
            email: tenant.email,
          }
        : undefined;
      const rows = (await storage.getReferences(ctx.employeeId)).filter(
        (r) => (r.referenceKind || "personal") === "personal",
      );
      const results: { id: number; refereeName: string; ok: boolean; error?: string }[] = [];
      for (const ref of rows) {
        if (!ref.refereeEmail?.trim()) {
          results.push({ id: ref.id, refereeName: ref.refereeName, ok: false, error: "No referee email" });
          continue;
        }
        const result = await staffProfileStorage.sendPersonalReferenceVerification(
          ref.id,
          ctx.employeeId,
          ctx.employee.tenantId,
          ctx.user.id,
          employeeName,
          tenantInfo,
        );
        results.push({
          id: ref.id,
          refereeName: ref.refereeName,
          ok: result.ok,
          error: result.ok ? undefined : result.error,
        });
      }
      res.json({ results, sent: results.filter((r) => r.ok).length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/employment-history", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const employerName = String(req.body.employerName || "").trim();
      const jobTitle = String(req.body.jobTitle || "").trim();
      const dateFrom = req.body.dateFrom;
      if (!employerName || !jobTitle || !dateFrom) {
        return res.status(400).json({ message: "employerName, jobTitle, dateFrom required" });
      }
      const row = await staffProfileStorage.createEmployment({
        employeeId: ctx.employeeId,
        employerName,
        jobTitle,
        dateFrom,
        dateTo: req.body.dateTo || null,
        isCurrent: !!req.body.isCurrent,
        reasonForLeaving: req.body.reasonForLeaving || null,
        refereePhone: req.body.refereePhone || null,
        refereeEmail: req.body.refereeEmail || null,
      });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/employees/:id/employment-history/:histId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const employerName = String(req.body.employerName || "").trim();
      const jobTitle = String(req.body.jobTitle || "").trim();
      const dateFrom = req.body.dateFrom;
      if (!employerName || !jobTitle || !dateFrom) {
        return res.status(400).json({ message: "employerName, jobTitle, dateFrom required" });
      }
      const row = await staffProfileStorage.updateEmployment(paramId(req.params.histId), ctx.employeeId, {
        employerName,
        jobTitle,
        dateFrom,
        dateTo: req.body.dateTo || null,
        isCurrent: !!req.body.isCurrent,
        reasonForLeaving: req.body.reasonForLeaving ?? undefined,
        refereePhone: req.body.refereePhone || null,
        refereeEmail: req.body.refereeEmail || null,
      });
      if (!row) return res.status(404).json({ message: "Employment record not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/employees/:id/employment-history/:histId", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      await staffProfileStorage.deleteEmployment(paramId(req.params.histId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/employment-history/:histId/verbal-enquiry", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const updated = await staffProfileStorage.recordEmploymentVerbalEnquiry(
        paramId(req.params.histId),
        ctx.employeeId,
        ctx.employee.tenantId,
        ctx.user.id,
        {
          confirmedFrom: req.body.confirmedFrom || null,
          confirmedTo: req.body.confirmedTo || null,
          screeningComments: req.body.screeningComments || null,
          confirmedVerbally: !!req.body.confirmedVerbally,
        },
      );
      if (!updated) return res.status(404).json({ message: "Employment record not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/employment-history/:histId/send-verification", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;
      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      const result = await staffProfileStorage.sendEmploymentReferenceVerification(
        paramId(req.params.histId),
        ctx.employeeId,
        ctx.employee.tenantId,
        ctx.user.id,
        employeeName,
        tenant
          ? {
              companyName: tenant.name,
              tradingName: tenant.tradingName,
              email: tenant.email,
            }
          : undefined,
        typeof req.body?.refereeEmail === "string" ? req.body.refereeEmail : null,
      );
      if (!result.ok) return res.status(400).json({ message: result.error });
      res.json(result.record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/employees/:id/employment-history/:histId/reference-pdf", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const histId = paramId(req.params.histId);
      const { getSubmittedEmploymentReferenceToken, buildEmploymentReferenceConfirmationPdf } = await import("./employment-reference-verify");
      const tokenRow = await getSubmittedEmploymentReferenceToken(histId);
      if (!tokenRow || tokenRow.employeeId !== ctx.employeeId) {
        return res.status(404).json({ message: "No submitted reference confirmation found for this employer" });
      }
      const histRows = await storage.getEmploymentHistory(ctx.employeeId);
      const hist = histRows.find((h) => h.id === histId);
      if (!hist) return res.status(404).json({ message: "Employment record not found" });

      const pdf = await buildEmploymentReferenceConfirmationPdf(tokenRow, hist);
      if (!pdf) return res.status(404).json({ message: "Confirmation PDF is not available for this reference" });

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      });
      res.send(pdf.buffer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/employment-history/send-all-verifications", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;
      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      const tenantInfo = tenant
        ? {
            companyName: tenant.name,
            tradingName: tenant.tradingName,
            email: tenant.email,
          }
        : undefined;
      const rows = await storage.getEmploymentHistory(ctx.employeeId);
      const results: { id: number; employerName: string; ok: boolean; error?: string }[] = [];
      for (const hist of rows) {
        if (!hist.refereeEmail?.trim()) {
          results.push({ id: hist.id, employerName: hist.employerName, ok: false, error: "No referee email" });
          continue;
        }
        const result = await staffProfileStorage.sendEmploymentReferenceVerification(
          hist.id,
          ctx.employeeId,
          ctx.employee.tenantId,
          ctx.user.id,
          employeeName,
          tenantInfo,
        );
        results.push({
          id: hist.id,
          employerName: hist.employerName,
          ok: result.ok,
          error: result.ok ? undefined : result.error,
        });
      }
      res.json({ results, sent: results.filter((r) => r.ok).length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/employees/:id/bank-details", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const { accountName, bankName, sortCode, accountNumber, buildingSocietyRef } = req.body;
      if (!accountName || !bankName || !sortCode || !accountNumber) {
        return res.status(400).json({ message: "Account name, bank name, sort code, and account number are required" });
      }
      const payload = {
        accountName: String(accountName).trim(),
        bankName: String(bankName).trim(),
        sortCode: String(sortCode).trim(),
        accountNumber: String(accountNumber).trim(),
        buildingSocietyRef: buildingSocietyRef ? String(buildingSocietyRef).trim() : null,
      };
      const existing = await storage.getBankDetails(ctx.employeeId);
      const row = existing
        ? await storage.updateBankDetails(existing.id, payload)
        : await storage.createBankDetails({ ...payload, employeeId: ctx.employeeId });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/employees/:id/immigration", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const b = req.body || {};
      const bool = (v: unknown) => {
        if (v === true || v === "true" || v === "YES" || v === "yes" || v === 1 || v === "1") return true;
        if (v === false || v === "false" || v === "NO" || v === "no" || v === 0 || v === "0") return false;
        return null;
      };
      const str = (v: unknown) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s.length ? s : null;
      };
      const row = await storage.upsertEmployeeImmigration(ctx.employeeId, {
        tenantId: ctx.employee.tenantId,
        passportDocNo: str(b.passportDocNo),
        passportCountry: str(b.passportCountry),
        passportIssueDate: str(b.passportIssueDate),
        passportExpiryDate: str(b.passportExpiryDate),
        visaNeeded: bool(b.visaNeeded) ?? false,
        visaType: str(b.visaType),
        visaIssueDate: str(b.visaIssueDate),
        visaExpiryDate: str(b.visaExpiryDate),
        visaDateOfEntry: str(b.visaDateOfEntry),
        shareCode: str(b.shareCode),
        shareCodeExpiry: str(b.shareCodeExpiry),
        brpNeeded: bool(b.brpNeeded) ?? false,
        brpNumber: str(b.brpNumber),
        brpExpiry: str(b.brpExpiry),
      });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/documents", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const documentType = String(req.body.documentType || "").trim();
      const fileName = String(req.body.fileName || "").trim();
      const fileUrl = String(req.body.fileUrl || "").trim();
      if (!documentType || !fileName || !fileUrl) {
        return res.status(400).json({ message: "documentType, fileName, and fileUrl are required" });
      }
      const doc = await storage.createDocument({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        documentType,
        fileName,
        fileUrl,
        mimeType: req.body.mimeType || null,
        fileSize: req.body.fileSize != null ? Number(req.body.fileSize) : null,
        expiryDate: req.body.expiryDate || null,
        notes: req.body.notes || null,
        isVerified: false,
      });
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/documents/:docId/verify", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const updated = await staffProfileStorage.verifyDocument(paramId(req.params.docId), ctx.employeeId, ctx.user.id);
      if (!updated) return res.status(404).json({ message: "Document not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/documents/request", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;

      const rawTypes: unknown[] = Array.isArray(req.body?.documentTypes)
        ? req.body.documentTypes
        : req.body?.documentType
          ? [req.body.documentType]
          : [];
      const documentTypes = Array.from(
        new Set(rawTypes.map((t) => String(t || "").trim()).filter(Boolean)),
      );
      if (documentTypes.length === 0) {
        return res.status(400).json({ message: "At least one document type is required" });
      }
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const to = String(req.body?.to || empUser?.email || ctx.employee.portalEmail || "").trim();
      if (!to || !to.includes("@")) {
        return res.status(400).json({ message: "Employee has no email on file — provide a recipient email" });
      }

      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;

      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      const documentTypeLabels = documentTypes.map((documentType) =>
        documentType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      );

      const { sendDocumentRequestEmail } = await import("./email");
      const sent = await sendDocumentRequestEmail({
        to,
        employeeName,
        companyName: tenant?.name,
        tradingName: tenant?.tradingName,
        replyTo: tenant?.email,
        tenantEmail: tenant?.email,
        tenantId: ctx.employee.tenantId,
        documentTypeLabels,
        message: message || null,
        myDocumentsUrl: `${appBaseUrl()}/my-documents`,
      });
      if (!sent.ok) {
        return res.status(400).json({ message: sent.error || "Email failed" });
      }

      await staffProfileStorage.addVettingAudit({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        code: "SDR",
        action: "Document request email sent",
        details: `Requested ${documentTypeLabels.join(", ")} from ${to}${message ? ` — "${message}"` : ""}${sent.via ? ` via ${sent.via}` : ""}`,
        colorKey: "blue",
        createdBy: ctx.user.id,
      });

      res.json({ success: true, sentTo: to, documentTypes, via: sent.via });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/employees/:id/deployment-gate", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const gate = await staffProfileStorage.validateDeployment(ctx.employeeId);
      res.json(gate);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/employees/:id/vetting-documents", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const { listAvailableVettingDocuments, vettingDocsDirectoryExists } = await import("./vetting-document-service");
      if (!vettingDocsDirectoryExists()) {
        return res.status(503).json({ message: "Screening & Vetting templates are not installed on this server" });
      }
      const tenant = ctx.employee.tenantId ? await storage.getTenant(ctx.employee.tenantId) : null;
      res.json({
        forms: listAvailableVettingDocuments(ctx.employee.officerType),
        hrSignatoryConfigured: !!(tenant?.hrSignatoryName && tenant?.hrSignatureData),
        companyConfigured: !!(tenant?.name && (tenant.addressLine1 || tenant.address)),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/employees/:id/vetting-documents/:code", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const { generateVettingDocument, vettingDocsDirectoryExists } = await import("./vetting-document-service");
      if (!vettingDocsDirectoryExists()) {
        return res.status(503).json({ message: "Screening & Vetting templates are not installed on this server" });
      }
      if (!ctx.employee.tenantId) {
        return res.status(400).json({ message: "Employee has no tenant assigned" });
      }
      const tenant = await storage.getTenant(ctx.employee.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const { staffProfileStorage } = await import("./staff-profile-storage");
      const { getLatestVettingFormAnswers } = await import("./employee-vetting-form-service");
      const [emergencyContacts, bankDetails, employmentHistory, references, extras, screeningAnswers] = await Promise.all([
        storage.getEmergencyContacts(ctx.employeeId),
        storage.getBankDetails(ctx.employeeId),
        storage.getEmploymentHistory(ctx.employeeId),
        storage.getReferences(ctx.employeeId),
        staffProfileStorage.getStaffProfileExtras(ctx.employeeId),
        getLatestVettingFormAnswers(ctx.employeeId),
      ]);
      const asPdf = String(req.query.format || "").toLowerCase() === "pdf";
      const screeningExceptions =
        typeof req.query.exceptions === "string" ? req.query.exceptions : undefined;

      const result = await generateVettingDocument(
        String(req.params.code),
        tenant,
        {
          ...ctx.employee,
          emergencyContacts,
          bankDetails,
          employmentHistory,
          references,
          drivingLicences: extras.drivingLicences,
          health: extras.health,
          education: extras.education,
          screeningAnswers,
        },
        empUser,
        { asPdf, screeningExceptions },
      );

      res.set({
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      });
      res.send(result.buffer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/vetting-documents/send-packet", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      const { listAvailableVettingDocuments, vettingDocsDirectoryExists } = await import("./vetting-document-service");
      if (!vettingDocsDirectoryExists()) {
        return res.status(503).json({ message: "Screening & Vetting templates are not installed on this server" });
      }
      if (!ctx.employee.tenantId) {
        return res.status(400).json({ message: "Employee has no tenant assigned" });
      }
      const tenant = await storage.getTenant(ctx.employee.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const to = String(req.body?.to || "").trim();
      if (!to || !to.includes("@")) {
        return res.status(400).json({ message: "A valid recipient email is required" });
      }

      const requestedCodes = Array.isArray(req.body?.documentCodes)
        ? req.body.documentCodes.map((code: unknown) => String(code || "").toLowerCase().trim()).filter(Boolean)
        : [];
      if (requestedCodes.length === 0) {
        return res.status(400).json({ message: "Select at least one document to send" });
      }

      const availableForms = listAvailableVettingDocuments(ctx.employee.officerType).filter((form) => form.downloadable);
      const availableMap = new Map(availableForms.map((form) => [form.code, form]));
      const documentCodes = [...new Set(requestedCodes)].filter((code) => availableMap.has(code));
      if (documentCodes.length === 0) {
        return res.status(400).json({ message: "Selected documents are not available for this employee" });
      }

      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;
      const documentLabels = documentCodes.map((code) => availableMap.get(code)?.label || code.toUpperCase());

      const { createVettingPacketToken } = await import("./vetting-packet-service");
      const created = await createVettingPacketToken({
        tenantId: ctx.employee.tenantId,
        employeeId: ctx.employeeId,
        recipientEmail: to,
        documentCodes,
        createdBy: ctx.user.id,
      });

      const { sendVettingPacketEmail } = await import("./email");
      const sent = await sendVettingPacketEmail({
        to,
        employeeName,
        companyName: tenant.name,
        tradingName: tenant.tradingName,
        replyTo: tenant.email,
        tenantEmail: tenant.email,
        tenantId: ctx.employee.tenantId,
        packetUrl: created.packetUrl,
        documentLabels,
        expiresAt: created.expiresAt,
      });
      if (!sent.ok) {
        return res.status(400).json({ message: sent.error || "Email failed" });
      }

      await staffProfileStorage.addVettingAudit({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        code: "SDR",
        action: "Vetting document packet email sent",
        details: `Sent ${documentLabels.join(", ")} to ${to}${sent.via ? ` via ${sent.via}` : ""}; link expires ${created.expiresAt.toISOString()}`,
        colorKey: "blue",
        createdBy: ctx.user.id,
      });

      res.json({
        success: true,
        expiresAt: created.expiresAt,
        sentTo: to,
        documentCodes,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/vetting-packets/:token", async (req, res) => {
    try {
      const { getVettingPacketByToken } = await import("./vetting-packet-service");
      const result = await getVettingPacketByToken(String(req.params.token || ""));
      if (!result.ok) {
        return res.status(result.status || 404).json({ message: result.error });
      }
      res.set({
        "Content-Type": result.data.contentType,
        "Content-Disposition": `attachment; filename="${result.data.filename}"`,
        "Cache-Control": "private, no-store",
      });
      res.send(result.data.buffer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/employees/:id/vetting-form/send-link", guard, async (req, res) => {
    try {
      const ctx = await loadEmployeeScoped(req, res);
      if (!ctx) return;
      if (!ctx.employee.tenantId) {
        return res.status(400).json({ message: "Employee has no tenant assigned" });
      }
      const tenant = await storage.getTenant(ctx.employee.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const to = String(req.body?.to || "").trim();
      if (!to || !to.includes("@")) {
        return res.status(400).json({ message: "A valid recipient email is required" });
      }

      const empUser = ctx.employee.userId ? await storage.getUser(ctx.employee.userId) : null;
      const employeeName =
        `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
        ctx.employee.employeeNumber ||
        `Employee #${ctx.employeeId}`;

      const created = await createEmployeeVettingFormToken({
        tenantId: ctx.employee.tenantId,
        employeeId: ctx.employeeId,
        recipientEmail: to,
        createdBy: ctx.user.id,
      });

      const { sendVettingFormLinkEmail } = await import("./email");
      const sent = await sendVettingFormLinkEmail({
        to,
        employeeName,
        companyName: tenant.name,
        tradingName: tenant.tradingName,
        replyTo: tenant.email,
        tenantEmail: tenant.email,
        tenantId: ctx.employee.tenantId,
        formUrl: created.formUrl,
        expiresAt: created.expiresAt,
      });
      if (!sent.ok) {
        return res.status(400).json({ message: sent.error || "Email failed" });
      }

      await staffProfileStorage.addVettingAudit({
        employeeId: ctx.employeeId,
        tenantId: ctx.employee.tenantId,
        code: "SDR",
        action: "Vetting application form link sent",
        details: `Application form link sent to ${to}${sent.via ? ` via ${sent.via}` : ""}; expires ${created.expiresAt.toISOString()}`,
        colorKey: "blue",
        createdBy: ctx.user.id,
      });

      res.json({
        success: true,
        expiresAt: created.expiresAt,
        sentTo: to,
        formUrl: created.formUrl,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/public/vetting-form/:token", async (req, res) => {
    try {
      const result = await getVettingFormByToken(String(req.params.token || ""));
      if (!result.ok) {
        return res.status(result.status || 404).json({ message: result.error });
      }
      res.json(result.data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/public/vetting-form/:token", async (req, res) => {
    try {
      const result = await saveVettingFormByToken(String(req.params.token || ""), req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ message: result.error });
      }
      res.json({ success: true, lastSavedAt: result.lastSavedAt, form: result.form });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/public/vetting-form/:token/submit", async (req, res) => {
    try {
      const result = await submitVettingFormByToken(String(req.params.token || ""), req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ message: result.error });
      }
      res.json({ success: true, submittedAt: result.submittedAt });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Public employment reference verification (no auth — tokenised link from email)
  app.get("/api/verify/employment/:token", async (req, res) => {
    try {
      const { getEmploymentReferenceFormByToken } = await import("./employment-reference-verify");
      const result = await getEmploymentReferenceFormByToken(String(req.params.token || ""));
      if (!result.ok) {
        return res.status(result.status || 404).json({
          message: result.error,
          submitted: !!(result as any).submitted,
        });
      }
      res.json(result.data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verify/employment/:token", async (req, res) => {
    try {
      const { submitEmploymentReferenceForm } = await import("./employment-reference-verify");
      const result = await submitEmploymentReferenceForm(String(req.params.token || ""), req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ message: result.error });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public personal reference verification (no auth — tokenised link from email)
  app.get("/api/verify/personal/:token", async (req, res) => {
    try {
      const { getPersonalReferenceFormByToken } = await import("./personal-reference-verify");
      const result = await getPersonalReferenceFormByToken(String(req.params.token || ""));
      if (!result.ok) {
        return res.status(result.status || 404).json({
          message: result.error,
          submitted: !!(result as any).submitted,
        });
      }
      res.json(result.data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verify/personal/:token", async (req, res) => {
    try {
      const { submitPersonalReferenceForm } = await import("./personal-reference-verify");
      const result = await submitPersonalReferenceForm(String(req.params.token || ""), req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ message: result.error });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
