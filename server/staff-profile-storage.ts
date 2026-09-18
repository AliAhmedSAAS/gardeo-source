import { eq, desc, and, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  employees,
  documents,
  employeeNotes,
  employeePreferredSites,
  employeeEducation,
  employeeDrivingLicences,
  employeeHealth,
  employeeCertificates,
  employeeSiaLicences,
  pFormRecords,
  employeeVettingFormTokens,
  vettingAuditEvents,
  rightOfWorkChecks,
  employeeAddressHistory,
  sites,
  clients,
  employmentHistory,
  employmentReferenceTokens,
  type InsertEmployeeNote,
  type InsertEmployeePreferredSite,
  type InsertEmployeeEducation,
  type InsertEmployeeDrivingLicence,
  type InsertEmployeeHealth,
  type InsertEmployeeCertificate,
  type InsertEmployeeSiaLicence,
  type InsertPFormRecord,
  type InsertVettingAuditEvent,
  type InsertRightOfWorkCheck,
  type InsertEmployeeAddressHistory,
  type InsertReference,
  type InsertEmploymentHistory,
  resolveDeploymentGateSettings,
} from "@shared/schema";
import {
  buildEmploymentTelephoneScreeningPlan,
  buildEmploymentEmailSendingPlan,
  buildEmploymentSubmitVerificationPlan,
  reminderStatsFromEvents,
  formatLondonYmd,
  resolveRegistrationDate,
} from "./employment-telephone-screening";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const POA_TYPES = ["proof_of_address", "utility_bill", "council_tax", "bank_statement"];
const MIN_DEPLOY_STEP = 5;

export type DeploymentGateResult = { ok: boolean; missing: string[] };

export const staffProfileStorage = {
  async getStaffProfileExtras(employeeId: number) {
    const [
      notes,
      preferredRaw,
      education,
      drivingLicences,
      healthRows,
      certificates,
      siaLicences,
      pFormRows,
      vettingAudit,
      rightOfWorkChecksList,
      addressHistory,
      appFormRows,
    ] = await Promise.all([
      db.select().from(employeeNotes).where(eq(employeeNotes.employeeId, employeeId)).orderBy(desc(employeeNotes.createdAt)),
      db
        .select({
          id: employeePreferredSites.id,
          employeeId: employeePreferredSites.employeeId,
          tenantId: employeePreferredSites.tenantId,
          siteId: employeePreferredSites.siteId,
          preferenceType: employeePreferredSites.preferenceType,
          createdAt: employeePreferredSites.createdAt,
          siteName: sites.name,
          clientName: clients.companyName,
        })
        .from(employeePreferredSites)
        .leftJoin(sites, eq(employeePreferredSites.siteId, sites.id))
        .leftJoin(clients, eq(sites.clientId, clients.id))
        .where(eq(employeePreferredSites.employeeId, employeeId))
        .orderBy(desc(employeePreferredSites.createdAt)),
      db.select().from(employeeEducation).where(eq(employeeEducation.employeeId, employeeId)).orderBy(desc(employeeEducation.dateFrom)),
      db.select().from(employeeDrivingLicences).where(eq(employeeDrivingLicences.employeeId, employeeId)).orderBy(desc(employeeDrivingLicences.createdAt)),
      db.select().from(employeeHealth).where(eq(employeeHealth.employeeId, employeeId)).limit(1),
      db.select().from(employeeCertificates).where(eq(employeeCertificates.employeeId, employeeId)).orderBy(desc(employeeCertificates.createdAt)),
      db.select().from(employeeSiaLicences).where(eq(employeeSiaLicences.employeeId, employeeId)).orderBy(desc(employeeSiaLicences.createdAt)),
      db.select().from(pFormRecords).where(eq(pFormRecords.employeeId, employeeId)).limit(1),
      db.select().from(vettingAuditEvents).where(eq(vettingAuditEvents.employeeId, employeeId)).orderBy(sql`COALESCE(${vettingAuditEvents.eventAt}, ${vettingAuditEvents.createdAt}) DESC`),
      db.select().from(rightOfWorkChecks).where(eq(rightOfWorkChecks.employeeId, employeeId)).orderBy(desc(rightOfWorkChecks.createdAt)),
      db.select().from(employeeAddressHistory).where(eq(employeeAddressHistory.employeeId, employeeId)).orderBy(desc(employeeAddressHistory.livingFrom)),
      db
        .select({
          id: employeeVettingFormTokens.id,
          submittedAt: employeeVettingFormTokens.submittedAt,
          lastSavedAt: employeeVettingFormTokens.lastSavedAt,
          expiresAt: employeeVettingFormTokens.expiresAt,
          recipientEmail: employeeVettingFormTokens.recipientEmail,
          createdAt: employeeVettingFormTokens.createdAt,
        })
        .from(employeeVettingFormTokens)
        .where(eq(employeeVettingFormTokens.employeeId, employeeId))
        .orderBy(desc(employeeVettingFormTokens.createdAt))
        .limit(10),
    ]);

    const preferredAppForm =
      appFormRows.find((r) => r.submittedAt) ||
      appFormRows[0] ||
      null;

    let applicationFormStatus: "not_sent" | "sent" | "in_progress" | "submitted" = "not_sent";
    if (preferredAppForm?.submittedAt) applicationFormStatus = "submitted";
    else if (preferredAppForm?.lastSavedAt) applicationFormStatus = "in_progress";
    else if (preferredAppForm) applicationFormStatus = "sent";

    return {
      notes,
      preferredSites: preferredRaw,
      education,
      drivingLicences,
      health: healthRows[0] || null,
      certificates,
      siaLicences,
      pForm: pFormRows[0] || null,
      applicationForm: preferredAppForm
        ? {
            status: applicationFormStatus,
            submittedAt: preferredAppForm.submittedAt,
            lastSavedAt: preferredAppForm.lastSavedAt,
            expiresAt: preferredAppForm.expiresAt,
            recipientEmail: preferredAppForm.recipientEmail,
            createdAt: preferredAppForm.createdAt,
          }
        : { status: "not_sent" as const },
      vettingAudit,
      rightOfWorkChecks: rightOfWorkChecksList,
      addressHistory,
    };
  },

  async validateDeployment(
    employeeId: number,
    opts?: { dutyTypeId?: number | null },
  ): Promise<DeploymentGateResult> {
    const missing: string[] = [];
    const employee = await storage.getEmployee(employeeId);
    if (!employee) return { ok: false, missing: ["Employee not found"] };

    const tenant = employee.tenantId ? await storage.getTenant(employee.tenantId) : undefined;
    const gate = resolveDeploymentGateSettings(tenant?.deploymentGateSettings);

    if (!gate.enabled) {
      return { ok: true, missing: [] };
    }

    const step = employee.officerStep ?? 0;
    if (gate.requireOfficerStep && step < MIN_DEPLOY_STEP) {
      missing.push(`Officer step must be at least ${MIN_DEPLOY_STEP} (current: ${step})`);
    }

    if (gate.requireNiNumber && !employee.nationalInsurance?.trim()) {
      missing.push("NI number required");
    }

    const immigration = await storage.getEmployeeImmigration(employeeId);
    const docs = await storage.getDocuments(employeeId);
    const hasPassportDoc = docs.some((d) =>
      ["passport", "passport_id", "identity", "proof_of_identity"].includes((d.documentType || "").toLowerCase())
    );
    if (gate.requirePassportId && !immigration?.passportDocNo && !hasPassportDoc) {
      missing.push("Passport / ID document required");
    }

    if (gate.requireShareCode) {
      if (immigration?.shareCode) {
        if (immigration.shareCodeExpiry && new Date(immigration.shareCodeExpiry) < new Date()) {
          missing.push("Share code expired");
        }
      } else if (immigration?.visaNeeded || immigration?.brpNeeded) {
        missing.push("Share code required");
      }
    }

    const hasPoa = docs.some((d) => POA_TYPES.includes((d.documentType || "").toLowerCase()));
    if (gate.requireProofOfAddress && !hasPoa) {
      missing.push("Proof of address (utility bill or bank statement) required");
    }

    let dutyRequiresLicense = false;
    if (opts?.dutyTypeId && employee.tenantId) {
      const dutyType = await storage.getTenantDutyType(employee.tenantId, opts.dutyTypeId);
      dutyRequiresLicense = Boolean(dutyType?.requiresLicense);
    }

    // SIA / licence check only when the selected duty type requires a licence
    if (gate.requireSiaLicence && dutyRequiresLicense) {
      const siaLicences = await db.select().from(employeeSiaLicences).where(eq(employeeSiaLicences.employeeId, employeeId));
      const defaultSia = siaLicences.find((s) => s.isDefault) || siaLicences[0];
      const siaNumber = defaultSia?.siaNumber || employee.siaLicenseNumber;
      const siaExpiry = defaultSia?.expiryDate || employee.siaExpiryDate;
      if (!siaNumber) {
        missing.push("Valid SIA licence required for this duty type");
      } else if (siaExpiry && new Date(siaExpiry) < new Date()) {
        missing.push("SIA licence expired");
      }
    }

    if (gate.requireApplicationForm) {
      const [submittedAppForm] = await db
        .select({ id: employeeVettingFormTokens.id })
        .from(employeeVettingFormTokens)
        .where(and(
          eq(employeeVettingFormTokens.employeeId, employeeId),
          isNotNull(employeeVettingFormTokens.submittedAt),
        ))
        .limit(1);
      if (!submittedAppForm) {
        missing.push("Application form must be submitted");
      }
    }

    return { ok: missing.length === 0, missing };
  },

  async createNote(data: InsertEmployeeNote) {
    const [row] = await db.insert(employeeNotes).values(data).returning();
    return row;
  },

  async deleteNote(id: number, employeeId: number) {
    await db.delete(employeeNotes).where(and(eq(employeeNotes.id, id), eq(employeeNotes.employeeId, employeeId)));
  },

  async createPreferredSite(data: InsertEmployeePreferredSite) {
    const [row] = await db.insert(employeePreferredSites).values(data).returning();
    return row;
  },

  async deletePreferredSite(id: number, employeeId: number) {
    await db.delete(employeePreferredSites).where(and(eq(employeePreferredSites.id, id), eq(employeePreferredSites.employeeId, employeeId)));
  },

  async createEducation(data: InsertEmployeeEducation) {
    const [row] = await db.insert(employeeEducation).values(data).returning();
    return row;
  },

  async updateEducation(id: number, employeeId: number, data: Partial<InsertEmployeeEducation>) {
    const [row] = await db
      .update(employeeEducation)
      .set(data)
      .where(and(eq(employeeEducation.id, id), eq(employeeEducation.employeeId, employeeId)))
      .returning();
    return row;
  },

  async deleteEducation(id: number, employeeId: number) {
    await db.delete(employeeEducation).where(and(eq(employeeEducation.id, id), eq(employeeEducation.employeeId, employeeId)));
  },

  async createDrivingLicence(data: InsertEmployeeDrivingLicence) {
    const [row] = await db.insert(employeeDrivingLicences).values(data).returning();
    return row;
  },

  async updateDrivingLicence(id: number, employeeId: number, data: Partial<InsertEmployeeDrivingLicence>) {
    const [row] = await db
      .update(employeeDrivingLicences)
      .set(data)
      .where(and(eq(employeeDrivingLicences.id, id), eq(employeeDrivingLicences.employeeId, employeeId)))
      .returning();
    return row;
  },

  async deleteDrivingLicence(id: number, employeeId: number) {
    await db.delete(employeeDrivingLicences).where(and(eq(employeeDrivingLicences.id, id), eq(employeeDrivingLicences.employeeId, employeeId)));
  },

  async upsertHealth(employeeId: number, tenantId: number | null, data: Partial<InsertEmployeeHealth>) {
    const existing = await db.select().from(employeeHealth).where(eq(employeeHealth.employeeId, employeeId)).limit(1);
    if (existing[0]) {
      const [row] = await db
        .update(employeeHealth)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeHealth.employeeId, employeeId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(employeeHealth)
      .values({ employeeId, tenantId, ...data })
      .returning();
    return row;
  },

  async createCertificate(data: InsertEmployeeCertificate) {
    const [row] = await db.insert(employeeCertificates).values(data).returning();
    return row;
  },

  async deleteCertificate(id: number, employeeId: number) {
    await db.delete(employeeCertificates).where(and(eq(employeeCertificates.id, id), eq(employeeCertificates.employeeId, employeeId)));
  },

  async createSiaLicence(data: InsertEmployeeSiaLicence) {
    if (data.isDefault) {
      await db
        .update(employeeSiaLicences)
        .set({ isDefault: false })
        .where(eq(employeeSiaLicences.employeeId, data.employeeId));
    }
    const [row] = await db.insert(employeeSiaLicences).values(data).returning();
    return row;
  },

  async updateSiaLicence(id: number, employeeId: number, data: Partial<InsertEmployeeSiaLicence>) {
    if (data.isDefault) {
      await db.update(employeeSiaLicences).set({ isDefault: false }).where(eq(employeeSiaLicences.employeeId, employeeId));
    }
    const [row] = await db
      .update(employeeSiaLicences)
      .set(data)
      .where(and(eq(employeeSiaLicences.id, id), eq(employeeSiaLicences.employeeId, employeeId)))
      .returning();
    return row;
  },

  async deleteSiaLicence(id: number, employeeId: number) {
    await db.delete(employeeSiaLicences).where(and(eq(employeeSiaLicences.id, id), eq(employeeSiaLicences.employeeId, employeeId)));
  },

  async createRightOfWorkCheck(data: InsertRightOfWorkCheck) {
    const [row] = await db.insert(rightOfWorkChecks).values(data).returning();
    return row;
  },

  async updateRightOfWorkCheck(id: number, employeeId: number, data: Partial<InsertRightOfWorkCheck>) {
    const [row] = await db
      .update(rightOfWorkChecks)
      .set(data)
      .where(and(eq(rightOfWorkChecks.id, id), eq(rightOfWorkChecks.employeeId, employeeId)))
      .returning();
    return row;
  },

  async createAddressHistory(data: InsertEmployeeAddressHistory) {
    const [row] = await db.insert(employeeAddressHistory).values(data).returning();
    return row;
  },

  async deleteAddressHistory(id: number, employeeId: number) {
    await db.delete(employeeAddressHistory).where(and(eq(employeeAddressHistory.id, id), eq(employeeAddressHistory.employeeId, employeeId)));
  },

  async ensurePForm(employeeId: number, tenantId: number | null) {
    const [existing] = await db.select().from(pFormRecords).where(eq(pFormRecords.employeeId, employeeId)).limit(1);
    if (existing) return existing;
    const [row] = await db
      .insert(pFormRecords)
      .values({ employeeId, tenantId, status: "locked" })
      .returning();
    return row;
  },

  async unlockPForm(employeeId: number, tenantId: number | null, userId: string) {
    await this.ensurePForm(employeeId, tenantId);
    const [row] = await db
      .update(pFormRecords)
      .set({
        status: "pending",
        unlockedAt: new Date(),
        unlockedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(pFormRecords.employeeId, employeeId))
      .returning();

    await db.update(employees).set({ officerStep: 5, updatedAt: new Date() }).where(eq(employees.id, employeeId));
    await this.addVettingAudit({
      employeeId,
      tenantId,
      code: "DR",
      action: "P Form Unlocked",
      details: "Application form set to PENDING; officer step set to 5",
      colorKey: "orange",
      createdBy: userId,
    });
    return row;
  },

  async finishPForm(employeeId: number, tenantId: number | null, userId: string) {
    await this.ensurePForm(employeeId, tenantId);
    const [row] = await db
      .update(pFormRecords)
      .set({
        status: "finished",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pFormRecords.employeeId, employeeId))
      .returning();

    await db
      .update(employees)
      .set({ officerStep: 7, vettingCompleteAt: new Date(), updatedAt: new Date() })
      .where(eq(employees.id, employeeId));

    await this.addVettingAudit({
      employeeId,
      tenantId,
      code: "VC",
      action: "Vetting Complete",
      details: "P Form finished; officer step set to 7",
      colorKey: "black",
      createdBy: userId,
    });
    return row;
  },

  async addVettingAudit(data: InsertVettingAuditEvent & { createdAt?: Date }) {
    const payload: Record<string, unknown> = {
      employeeId: data.employeeId,
      code: data.code,
      action: data.action,
      details: data.details ?? null,
      colorKey: data.colorKey ?? null,
      tenantId: data.tenantId ?? null,
      createdBy: data.createdBy || null,
    };
    if (data.eventAt) payload.eventAt = data.eventAt;
    if (data.eventType) payload.eventType = data.eventType;
    if (data.employmentHistoryId != null) payload.employmentHistoryId = data.employmentHistoryId;
    if (data.createdAt) payload.createdAt = data.createdAt;
    // Avoid FK violations when tenant/user ids are missing or stale
    if (!payload.tenantId) delete payload.tenantId;
    if (!payload.createdBy) delete payload.createdBy;

    try {
      const [row] = await db.insert(vettingAuditEvents).values(payload as InsertVettingAuditEvent).returning();
      return row;
    } catch (err: any) {
      // Retry without optional FKs if constraint fails
      if (err?.code === "23503") {
        const { tenantId: _t, createdBy: _c, employmentHistoryId: _e, ...safe } = payload as any;
        const [row] = await db.insert(vettingAuditEvents).values(safe).returning();
        return row;
      }
      throw err;
    }
  },

  async createReference(data: InsertReference) {
    return storage.createReference(data);
  },

  async updateReference(id: number, data: Partial<InsertReference>) {
    return storage.updateReference(id, data);
  },

  async deleteReference(id: number) {
    return storage.deleteReference(id);
  },

  async createEmployment(data: InsertEmploymentHistory) {
    return storage.createEmploymentHistory(data);
  },

  async updateEmployment(id: number, employeeId: number, data: Partial<InsertEmploymentHistory>) {
    const rows = await storage.getEmploymentHistory(employeeId);
    if (!rows.find((r) => r.id === id)) return undefined;
    return storage.updateEmploymentHistory(id, data);
  },

  async deleteEmployment(id: number) {
    return storage.deleteEmploymentHistory(id);
  },

  async recordEmploymentVerbalEnquiry(
    histId: number,
    employeeId: number,
    tenantId: number | null,
    userId: string,
    data: {
      confirmedFrom?: string | null;
      confirmedTo?: string | null;
      screeningComments?: string | null;
      confirmedVerbally?: boolean;
    },
  ) {
    const rows = await storage.getEmploymentHistory(employeeId);
    const hist = rows.find((r) => r.id === histId);
    if (!hist) return null;

    const confirmedFrom = data.confirmedFrom?.trim() || null;
    const confirmedTo = data.confirmedTo?.trim() || null;
    const screeningComments = data.screeningComments?.trim() || null;

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(employmentHistory)
        .set({
          confirmedFrom,
          confirmedTo,
          screeningComments,
          verificationStatus: data.confirmedVerbally ? "verified" : "pending",
        })
        .where(eq(employmentHistory.id, histId))
        .returning();

      const auditBase = {
        employeeId,
        tenantId: tenantId || null,
        createdBy: userId || null,
      };

      const insertAudit = async (code: string, action: string, details: string, colorKey: string) => {
        const payload: any = {
          employeeId: auditBase.employeeId,
          code,
          action,
          details,
          colorKey,
        };
        if (auditBase.tenantId) payload.tenantId = auditBase.tenantId;
        if (auditBase.createdBy) payload.createdBy = auditBase.createdBy;
        try {
          await tx.insert(vettingAuditEvents).values(payload);
        } catch (err: any) {
          if (err?.code === "23503") {
            const { tenantId: _t, createdBy: _c, ...safe } = payload;
            await tx.insert(vettingAuditEvents).values(safe);
          } else {
            throw err;
          }
        }
      };

      await insertAudit(
        data.confirmedVerbally ? "CV" : "VE",
        data.confirmedVerbally ? "Confirmed Verbally" : "Verbal Enquiry",
        `Employment reference ${hist.employerName}${screeningComments ? `: ${screeningComments}` : ""}`,
        data.confirmedVerbally ? "black" : "purple",
      );

      if (data.confirmedVerbally) {
        await insertAudit(
          "WR",
          "Work reference",
          `Work reference verified for ${hist.employerName} (${confirmedFrom || "?"} – ${confirmedTo || "?"})`,
          "maroon",
        );
      }

      return updated;
    });
  },

  async sendEmploymentReferenceVerification(
    histId: number,
    employeeId: number,
    tenantId: number | null,
    userId: string,
    employeeName: string,
    tenantInfo?: {
      companyName?: string;
      tradingName?: string | null;
      email?: string | null;
    },
    refereeEmailOverride?: string | null,
  ) {
    const rows = await storage.getEmploymentHistory(employeeId);
    const hist = rows.find((r) => r.id === histId);
    if (!hist) return { ok: false as const, error: "Employment record not found" };

    const toEmail = (refereeEmailOverride || hist.refereeEmail || "").trim();
    if (!toEmail) {
      return { ok: false as const, error: `No referee email for ${hist.employerName}. Enter an email and try again.` };
    }

    if (refereeEmailOverride?.trim() && refereeEmailOverride.trim() !== (hist.refereeEmail || "").trim()) {
      await storage.updateEmploymentHistory(histId, { refereeEmail: toEmail });
    }

    const companyName = tenantInfo?.companyName || "Guardosmart";

    let verifyUrl: string | undefined;
    try {
      const { createEmploymentReferenceToken } = await import("./employment-reference-verify");
      const created = await createEmploymentReferenceToken({
        tenantId,
        employeeId,
        employmentHistoryId: histId,
      });
      verifyUrl = created.verifyUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[staff-profile] Failed to create employment verify token:", message);
      return { ok: false as const, error: "Could not create verification link. Check database migration." };
    }

    const { sendEmploymentReferenceRequest } = await import("./email");
    const sent = await sendEmploymentReferenceRequest({
      to: toEmail,
      employerName: hist.employerName,
      employeeName,
      jobTitle: hist.jobTitle,
      dateFrom: hist.dateFrom,
      dateTo: hist.dateTo,
      companyName,
      tradingName: tenantInfo?.tradingName,
      replyTo: tenantInfo?.email,
      tenantEmail: tenantInfo?.email,
      tenantId,
      verifyUrl,
    });
    if (!sent.ok) return { ok: false as const, error: sent.error || "Email failed" };

    const today = new Date().toISOString().slice(0, 10);
    const updated = await storage.updateEmploymentHistory(histId, {
      refereeEmail: toEmail,
      requestCount: (hist.requestCount || 0) + 1,
      requestedDate: today,
      verificationStatus: hist.verificationStatus || "pending",
    });

    await this.addVettingAudit({
      employeeId,
      tenantId,
      code: "CL",
      action: "Employment reference email sent",
      details: `Reference verification email sent to ${toEmail} (${hist.employerName}) on behalf of ${companyName}${sent.via ? ` via ${sent.via}` : ""}${verifyUrl ? " with online form link" : ""}`,
      colorKey: "green",
      createdBy: userId,
    });

    return { ok: true as const, record: updated };
  },

  async sendStaffFeedbackQuestionnaire(
    employeeId: number,
    employee: { tenantId?: number | null; userId?: string | null; employeeNumber?: string | null; portalEmail?: string | null },
    userId: string,
    emailOverride?: string | null,
  ) {
    const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
    const officerName =
      `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
      employee.employeeNumber ||
      `Employee #${employeeId}`;
    const toEmail = (emailOverride || empUser?.email || employee.portalEmail || "").trim();
    if (!toEmail || !toEmail.includes("@")) {
      return { ok: false as const, error: "No officer email on file. Enter an email and try again." };
    }

    const tenant = employee.tenantId ? await storage.getTenant(employee.tenantId) : null;
    const companyName = tenant?.name || "Guardosmart";

    let verifyUrl: string | undefined;
    let expiresAt: Date | undefined;
    let issueNumber = 1;
    try {
      const { createStaffFeedbackToken } = await import("./staff-feedback-verify");
      const created = await createStaffFeedbackToken({
        tenantId: employee.tenantId ?? null,
        employeeId,
      });
      verifyUrl = created.verifyUrl;
      expiresAt = created.expiresAt;
      issueNumber = created.issueNumber;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[staff-profile] Failed to create staff feedback token:", message);
      return { ok: false as const, error: "Could not create feedback link. Check database migration." };
    }

    const { sendStaffFeedbackRequest } = await import("./email");
    const sent = await sendStaffFeedbackRequest({
      to: toEmail,
      employeeName: officerName,
      companyName,
      tradingName: tenant?.tradingName,
      replyTo: tenant?.email,
      tenantEmail: tenant?.email,
      tenantId: employee.tenantId ?? null,
      formUrl: verifyUrl!,
      expiresAt: expiresAt || new Date(),
    });
    if (!sent.ok) return { ok: false as const, error: sent.error || "Email failed" };

    await this.addVettingAudit({
      employeeId,
      tenantId: employee.tenantId ?? null,
      code: "FB",
      action: "Feedback questionnaire email sent",
      details: `Security Personnel Feedback Questionnaire (issue ${issueNumber}) emailed to ${toEmail} on behalf of ${companyName}${sent.via ? ` via ${sent.via}` : ""}`,
      colorKey: "teal",
      createdBy: userId,
    });

    return { ok: true as const, sentTo: toEmail, formUrl: verifyUrl, expiresAt, issueNumber };
  },

  async recordPersonalReferenceVerbalEnquiry(
    refId: number,
    employeeId: number,
    tenantId: number | null,
    userId: string,
    data: {
      screeningComments?: string | null;
      confirmedVerbally?: boolean;
    },
  ) {
    const rows = await storage.getReferences(employeeId);
    const ref = rows.find((r) => r.id === refId);
    if (!ref) return null;

    const screeningComments = data.screeningComments?.trim() || null;

    const updated = await storage.updateReference(refId, {
      screeningComments,
      verificationStatus: data.confirmedVerbally ? "verified" : "pending",
      responseReceived: data.confirmedVerbally ? true : ref.responseReceived,
      responseDate: data.confirmedVerbally ? new Date() : ref.responseDate,
      infoSupplied: data.confirmedVerbally ? true : ref.infoSupplied,
    });

    await this.addVettingAudit({
      employeeId,
      tenantId,
      code: data.confirmedVerbally ? "CV" : "VE",
      action: data.confirmedVerbally ? "Confirmed Verbally" : "Verbal Enquiry",
      details: `Personal reference ${ref.refereeName}${screeningComments ? `: ${screeningComments}` : ""}`,
      colorKey: data.confirmedVerbally ? "black" : "purple",
      createdBy: userId,
    });

    if (data.confirmedVerbally) {
      await this.addVettingAudit({
        employeeId,
        tenantId,
        code: "PR",
        action: "Personal reference",
        details: `Personal reference verified for ${ref.refereeName}`,
        colorKey: "maroon",
        createdBy: userId,
      });
    }

    return updated;
  },

  async sendPersonalReferenceVerification(
    refId: number,
    employeeId: number,
    tenantId: number | null,
    userId: string,
    employeeName: string,
    tenantInfo?: {
      companyName?: string;
      tradingName?: string | null;
      email?: string | null;
    },
    refereeEmailOverride?: string | null,
  ) {
    const rows = await storage.getReferences(employeeId);
    const ref = rows.find((r) => r.id === refId);
    if (!ref) return { ok: false as const, error: "Reference record not found" };

    const toEmail = (refereeEmailOverride || ref.refereeEmail || "").trim();
    if (!toEmail) {
      return { ok: false as const, error: `No referee email for ${ref.refereeName}. Enter an email and try again.` };
    }

    if (refereeEmailOverride?.trim() && refereeEmailOverride.trim() !== (ref.refereeEmail || "").trim()) {
      await storage.updateReference(refId, { refereeEmail: toEmail });
    }

    const companyName = tenantInfo?.companyName || "Guardosmart";

    let verifyUrl: string | undefined;
    try {
      const { createPersonalReferenceToken } = await import("./personal-reference-verify");
      const created = await createPersonalReferenceToken({
        tenantId,
        employeeId,
        referenceId: refId,
      });
      verifyUrl = created.verifyUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[staff-profile] Failed to create personal reference verify token:", message);
      return { ok: false as const, error: "Could not create verification link. Check database migration." };
    }

    const { sendPersonalReferenceRequest } = await import("./email");
    const sent = await sendPersonalReferenceRequest({
      to: toEmail,
      refereeName: ref.refereeName,
      employeeName,
      relationship: ref.relationship,
      companyName,
      tradingName: tenantInfo?.tradingName,
      replyTo: tenantInfo?.email,
      tenantEmail: tenantInfo?.email,
      tenantId,
      verifyUrl,
    });
    if (!sent.ok) return { ok: false as const, error: sent.error || "Email failed" };

    const today = new Date().toISOString().slice(0, 10);
    const updated = await storage.updateReference(refId, {
      refereeEmail: toEmail,
      requestCount: (ref.requestCount || 0) + 1,
      requestedDate: today,
      verificationStatus: ref.verificationStatus || "pending",
    });

    await this.addVettingAudit({
      employeeId,
      tenantId,
      code: "CL",
      action: "Personal reference email sent",
      details: `Reference verification email sent to ${toEmail} (${ref.refereeName}) on behalf of ${companyName}${sent.via ? ` via ${sent.via}` : ""}${verifyUrl ? " with online form link" : ""}`,
      colorKey: "green",
      createdBy: userId,
    });

    return { ok: true as const, record: updated };
  },

  async verifyDocument(documentId: number, employeeId: number, userId: string) {
    const docs = await storage.getDocuments(employeeId);
    const doc = docs.find((d) => d.id === documentId);
    if (!doc) return null;
    const [updated] = await db
      .update(documents)
      .set({
        isVerified: true,
        verifiedBy: userId,
        verifiedAt: new Date(),
      } as any)
      .where(eq(documents.id, documentId))
      .returning();
    return updated;
  },

  async runEmploymentTelephoneScreening(
    employeeId: number,
    employee: { createdAt?: Date | string | null; startDate?: string | null; vettingStartDate?: string | null; tenantId?: number | null },
    userId: string,
  ) {
    const jobs = await storage.getEmploymentHistory(employeeId);
    if (jobs.length === 0) {
      return { generated: 0, events: [] as any[], employmentUpdated: 0, message: "No employment records" };
    }

    const plan = buildEmploymentTelephoneScreeningPlan({
      registrationDate: resolveRegistrationDate(employee),
      jobs: jobs.map((job) => ({
        id: job.id,
        employerName: job.employerName,
        dateFrom: String(job.dateFrom).slice(0, 10),
        dateTo: job.dateTo ? String(job.dateTo).slice(0, 10) : null,
      })),
    });

    const written = await db.transaction(async (tx) => {
      const rows = [];
      for (const event of plan.events) {
        const payload: Record<string, unknown> = {
          employeeId,
          code: event.code,
          action: event.action,
          details: event.details,
          eventType: event.eventType,
          colorKey: event.colorKey,
          eventAt: event.eventAt,
          createdAt: event.eventAt,
        };
        if (event.employmentHistoryId != null) payload.employmentHistoryId = event.employmentHistoryId;
        if (employee.tenantId) payload.tenantId = employee.tenantId;
        if (userId) payload.createdBy = userId;
        const [row] = await tx.insert(vettingAuditEvents).values(payload as InsertVettingAuditEvent).returning();
        rows.push(row);
      }

      for (const update of plan.employmentUpdates) {
        await tx
          .update(employmentHistory)
          .set({
            confirmedFrom: update.confirmedFrom,
            confirmedTo: update.confirmedTo,
            verballyConfirmedAt: update.verballyConfirmedAt,
            verificationStatus: "verified",
          })
          .where(and(eq(employmentHistory.id, update.id), eq(employmentHistory.employeeId, employeeId)));
      }

      return rows;
    });

    return {
      generated: written.length,
      events: written,
      employmentUpdated: plan.employmentUpdates.length,
    };
  },

  async runEmploymentEmailSending(
    employeeId: number,
    employee: { tenantId?: number | null },
    userId: string,
  ) {
    const jobs = await storage.getEmploymentHistory(employeeId);
    if (jobs.length === 0) {
      return { generated: 0, events: [] as any[], message: "No employment records" };
    }

    const eligible = jobs.filter((job) => job.verballyConfirmedAt);
    if (eligible.length === 0) {
      return { generated: 0, events: [] as any[], employmentUpdated: 0, message: "No verbally confirmed employment records" };
    }

    const existingAudits = await db
      .select()
      .from(vettingAuditEvents)
      .where(eq(vettingAuditEvents.employeeId, employeeId));
    const existingStats = reminderStatsFromEvents(existingAudits);

    const toGenerate = eligible.filter((job) => !existingStats.has(job.id));
    const plan = buildEmploymentEmailSendingPlan(
      toGenerate.map((job) => ({
        id: job.id,
        employerName: job.employerName,
        verballyConfirmedAt: job.verballyConfirmedAt as Date | string,
      })),
    );

    const mergedStats = reminderStatsFromEvents([
      ...existingAudits,
      ...plan.events.map((event) => ({
        code: event.code,
        action: event.action,
        eventType: event.eventType,
        employmentHistoryId: event.employmentHistoryId,
        eventAt: event.eventAt,
        createdAt: event.eventAt,
      })),
    ]);

    if (plan.events.length === 0 && mergedStats.size === 0) {
      return { generated: 0, events: [] as any[], employmentUpdated: 0, message: "No verbally confirmed employment records" };
    }

    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const written = await db.transaction(async (tx) => {
      const rows = [];
      for (const event of plan.events) {
        const payload: Record<string, unknown> = {
          employeeId,
          code: event.code,
          action: event.action,
          details: event.details,
          eventType: event.eventType,
          colorKey: event.colorKey,
          eventAt: event.eventAt,
          createdAt: event.eventAt,
        };
        if (event.employmentHistoryId != null) payload.employmentHistoryId = event.employmentHistoryId;
        if (employee.tenantId) payload.tenantId = employee.tenantId;
        if (userId) payload.createdBy = userId;
        const [row] = await tx.insert(vettingAuditEvents).values(payload as InsertVettingAuditEvent).returning();
        rows.push(row);
      }

      let employmentUpdated = 0;
      for (const job of eligible) {
        const stats = mergedStats.get(job.id);
        if (!stats) continue;
        await tx
          .update(employmentHistory)
          .set({
            requestedDate: job.requestedDate || formatLondonYmd(stats.firstAt),
            requestCount: stats.count,
          })
          .where(and(eq(employmentHistory.id, job.id), eq(employmentHistory.employeeId, employeeId)));
        employmentUpdated += 1;
      }
      return { rows, employmentUpdated };
    });

    return {
      generated: written.rows.length,
      events: written.rows,
      employmentUpdated: written.employmentUpdated,
    };
  },

  async runEmploymentSubmitVerification(
    employeeId: number,
    employee: { tenantId?: number | null },
    userId: string,
  ) {
    const jobs = await storage.getEmploymentHistory(employeeId);
    if (jobs.length === 0) {
      return { generated: 0, events: [] as any[], message: "No employment records" };
    }

    const audits = await db
      .select()
      .from(vettingAuditEvents)
      .where(eq(vettingAuditEvents.employeeId, employeeId));

    const reminderStats = reminderStatsFromEvents(audits);
    const eligible = jobs
      .filter((job) => reminderStats.has(job.id))
      .map((job) => ({
        id: job.id,
        employerName: job.employerName,
        latestReminderAt: reminderStats.get(job.id)!.lastAt,
      }));

    if (eligible.length === 0) {
      return { generated: 0, events: [] as any[], message: "No email reminders" };
    }

    const plan = buildEmploymentSubmitVerificationPlan(eligible);
    if (plan.events.length === 0) {
      return { generated: 0, events: [] as any[], message: "No email reminders" };
    }

    const jobById = new Map(jobs.map((job) => [job.id, job]));

    const written = await db.transaction(async (tx) => {
      const rows = [];
      for (const event of plan.events) {
        const payload: Record<string, unknown> = {
          employeeId,
          code: event.code,
          action: event.action,
          details: event.details,
          eventType: event.eventType,
          colorKey: event.colorKey,
          eventAt: event.eventAt,
          createdAt: event.eventAt,
        };
        if (event.employmentHistoryId != null) payload.employmentHistoryId = event.employmentHistoryId;
        if (employee.tenantId) payload.tenantId = employee.tenantId;
        if (userId) payload.createdBy = userId;
        const [row] = await tx.insert(vettingAuditEvents).values(payload as InsertVettingAuditEvent).returning();
        rows.push(row);
      }

      for (const update of plan.employmentUpdates) {
        const hist = jobById.get(update.id);
        if (!hist) continue;
        await tx
          .update(employmentHistory)
          .set({
            submittedDate: update.submittedDate,
            verificationStatus: "verified",
            requestedDate: hist.requestedDate || formatLondonYmd(reminderStats.get(update.id)?.firstAt || update.verifiedAt),
            requestCount: Math.max(hist.requestCount || 0, reminderStats.get(update.id)?.count || 0),
          })
          .where(and(eq(employmentHistory.id, update.id), eq(employmentHistory.employeeId, employeeId)));

        const [existingToken] = await tx
          .select()
          .from(employmentReferenceTokens)
          .where(eq(employmentReferenceTokens.employmentHistoryId, update.id))
          .orderBy(desc(employmentReferenceTokens.id))
          .limit(1);

        const printName = existingToken?.refereePrintName?.trim() || "HR";
        const company = existingToken?.refereeCompany?.trim() || hist.employerName;
        const position = existingToken?.refereePosition?.trim() || "HR";
        const signature = existingToken?.refereeSignature?.trim() || printName;
        const answers = {
          usedAt: update.verifiedAt,
          informationConfirmed: existingToken?.informationConfirmed ?? true,
          detailsIfDifferent: existingToken?.detailsIfDifferent ?? null,
          attitude: existingToken?.attitude || "good",
          timeKeeping: existingToken?.timeKeeping || "good",
          timeOff: existingToken?.timeOff || "average",
          reasonForLeaving: existingToken?.reasonForLeaving || "own_accord",
          wouldReemploy: existingToken?.wouldReemploy || "yes",
          refereePrintName: printName,
          refereeCompany: company,
          refereePosition: position,
          refereeSignature: signature,
        };

        if (existingToken) {
          await tx
            .update(employmentReferenceTokens)
            .set(answers)
            .where(eq(employmentReferenceTokens.id, existingToken.id));
        } else {
          const expiresAt = new Date(update.verifiedAt);
          expiresAt.setDate(expiresAt.getDate() + 14);
          const tokenValues: Record<string, unknown> = {
            token: crypto.randomBytes(32).toString("hex"),
            employeeId,
            employmentHistoryId: update.id,
            expiresAt,
            ...answers,
          };
          if (employee.tenantId) tokenValues.tenantId = employee.tenantId;
          await tx.insert(employmentReferenceTokens).values(tokenValues as any);
        }
      }

      if (plan.vettingCompleteAt) {
        await tx
          .update(employees)
          .set({ vettingCompleteAt: plan.vettingCompleteAt, updatedAt: new Date() })
          .where(eq(employees.id, employeeId));
      }

      return rows;
    });

    const { buildEmploymentReferenceConfirmationPdf } = await import("./employment-reference-verify");
    for (const update of plan.employmentUpdates) {
      const hist = jobById.get(update.id);
      if (!hist) continue;
      try {
        const [tokenRow] = await db
          .select()
          .from(employmentReferenceTokens)
          .where(
            and(
              eq(employmentReferenceTokens.employmentHistoryId, update.id),
              isNotNull(employmentReferenceTokens.usedAt),
            ),
          )
          .orderBy(desc(employmentReferenceTokens.id))
          .limit(1);
        if (!tokenRow) continue;
        const pdf = await buildEmploymentReferenceConfirmationPdf(tokenRow, {
          ...hist,
          submittedDate: update.submittedDate,
          verificationStatus: "verified",
        }, { appliedPosition: "Security Officer" });
        if (!pdf) continue;
        await storage.createDocument({
          employeeId,
          tenantId: employee.tenantId ?? null,
          documentType: "employment_reference",
          fileName: pdf.filename,
          fileUrl: `data:application/pdf;base64,${pdf.buffer.toString("base64")}`,
          fileSize: pdf.buffer.length,
          mimeType: "application/pdf",
          isVerified: true,
          verifiedAt: update.verifiedAt,
          notes: `Employment reference confirmation for ${hist.employerName} (employment ${update.id}).`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[employment-submit-verification] Failed to generate confirmation PDF:", message);
      }
    }

    return {
      generated: written.length,
      events: written,
      employmentUpdated: plan.employmentUpdates.length,
      vettingCompleteAt: plan.vettingCompleteAt,
    };
  },

  async runCompletionCertification(
    employeeId: number,
    employee: {
      tenantId?: number | null;
      nationalInsurance?: string | null;
      userId?: string | null;
      employeeNumber?: string | null;
      vettingStartDate?: string | Date | null;
      startDate?: string | Date | null;
      createdAt?: Date | string | null;
    },
  ) {
    const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
    const officerName =
      `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
      employee.employeeNumber ||
      `Employee #${employeeId}`;
    const niNumber = (employee.nationalInsurance || "").trim().toUpperCase();
    const tenant = employee.tenantId ? await storage.getTenant(employee.tenantId) : null;
    const signatoryName = (tenant?.hrSignatoryName || "").trim();
    const signatoryPosition = (tenant?.hrSignatoryPosition || "").trim();
    const signatoryInitials = initialsFromName(signatoryName);

    const audits = await db
      .select()
      .from(vettingAuditEvents)
      .where(eq(vettingAuditEvents.employeeId, employeeId));

    const screeningCompletedAt = earliestMatchingAuditInstant(audits, isVettingCompleteEvent);
    const firstAuditAt = earliestMatchingAuditInstant(audits, () => true);
    const appointmentAt =
      parseDateValue(employee.vettingStartDate) ||
      parseDateValue(employee.startDate) ||
      firstAuditAt ||
      parseDateValue(employee.createdAt);
    const appointmentDate = appointmentAt ? formatUkDdMmYyyy(appointmentAt) : "";
    const screeningCompletedDate = screeningCompletedAt ? formatUkDdMmYyyy(screeningCompletedAt) : "";

    if (!employee.vettingStartDate && appointmentAt) {
      await db
        .update(employees)
        .set({ vettingStartDate: formatLondonYmd(appointmentAt), updatedAt: new Date() })
        .where(eq(employees.id, employeeId));
    }

    const { generateImsSe19CompletionCertificatePdf } = await import("./pdf-service");
    const buffer = await generateImsSe19CompletionCertificatePdf({
      companyName: tenant?.tradingName || tenant?.name || "Guardian FM",
      officerName,
      niNumber,
      appointmentDate,
      screeningCompletedDate,
      signatoryName,
      signatoryInitials,
      signatoryPosition,
      signatureImage: tenant?.hrSignatureData || null,
    });

    const safeName = officerName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || String(employeeId);
    const fileName = `IMS-SE-19-Completion-Certificate-${safeName}.pdf`;
    const fileUrl = writeBufferToUploads(buffer, ".pdf");
    const verifiedAt = screeningCompletedAt || new Date();
    const notes = "Certificate for Completion of Screening (IMS SE 19).";

    const [existing] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.employeeId, employeeId), eq(documents.documentType, "completion_certificate")))
      .orderBy(desc(documents.id))
      .limit(1);

    const fileFields = {
      fileName,
      fileUrl,
      fileSize: buffer.length,
      mimeType: "application/pdf" as const,
      notes,
      isVerified: true,
      verifiedAt,
    };

    if (existing?.fileUrl && existing.fileUrl !== fileUrl) {
      removeUploadedObject(existing.fileUrl);
    }

    const document = existing
      ? await storage.updateDocument(existing.id, fileFields)
      : await storage.createDocument({
          employeeId,
          tenantId: employee.tenantId ?? null,
          documentType: "completion_certificate",
          ...fileFields,
        });

    return {
      document,
      replaced: !!existing,
      officerName,
      niNumber: niNumber || null,
      appointmentDate: appointmentDate || null,
      screeningCompletedDate: screeningCompletedDate || null,
    };
  },
};

function auditInstant(event: { eventAt?: Date | null; createdAt?: Date | null }): Date | null {
  const value = event.eventAt || event.createdAt;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earliestMatchingAuditInstant(
  events: Array<{
    code?: string | null;
    action?: string | null;
    details?: string | null;
    eventType?: string | null;
    eventAt?: Date | null;
    createdAt?: Date | null;
  }>,
  match: (event: { code?: string | null; action?: string | null; details?: string | null; eventType?: string | null }) => boolean,
): Date | null {
  const instants = events
    .filter(match)
    .map(auditInstant)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  return instants[0] || null;
}

function auditText(event: { action?: string | null; details?: string | null; eventType?: string | null }): string {
  return `${event.action || ""} ${event.details || ""} ${event.eventType || ""}`;
}

function isVettingCompleteEvent(event: {
  code?: string | null;
  action?: string | null;
  details?: string | null;
  eventType?: string | null;
}): boolean {
  if ((event.code || "").toUpperCase() === "VC") return true;
  return /vetting complete/i.test(auditText(event));
}

function formatUkDdMmYyyy(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((part) => part[0]!.toUpperCase()).join(".") + ".";
}

function writeBufferToUploads(buffer: Buffer, extension: string): string {
  const uploadsDir = path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const safeName = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
  return `/objects/uploads/${safeName}`;
}

function removeUploadedObject(fileUrl: string): void {
  if (!fileUrl.startsWith("/objects/uploads/")) return;
  const base = path.basename(fileUrl);
  if (!base || base.includes("..")) return;
  try {
    fs.unlinkSync(path.join(process.cwd(), "uploads", base));
  } catch {
    // ignore missing previous file
  }
}
