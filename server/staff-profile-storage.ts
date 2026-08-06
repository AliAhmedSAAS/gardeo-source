import { eq, desc, and } from "drizzle-orm";
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
  vettingAuditEvents,
  rightOfWorkChecks,
  employeeAddressHistory,
  sites,
  clients,
  employmentHistory,
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
} from "@shared/schema";

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
      db.select().from(vettingAuditEvents).where(eq(vettingAuditEvents.employeeId, employeeId)).orderBy(desc(vettingAuditEvents.createdAt)),
      db.select().from(rightOfWorkChecks).where(eq(rightOfWorkChecks.employeeId, employeeId)).orderBy(desc(rightOfWorkChecks.createdAt)),
      db.select().from(employeeAddressHistory).where(eq(employeeAddressHistory.employeeId, employeeId)).orderBy(desc(employeeAddressHistory.livingFrom)),
    ]);

    return {
      notes,
      preferredSites: preferredRaw,
      education,
      drivingLicences,
      health: healthRows[0] || null,
      certificates,
      siaLicences,
      pForm: pFormRows[0] || null,
      vettingAudit,
      rightOfWorkChecks: rightOfWorkChecksList,
      addressHistory,
    };
  },

  async validateDeployment(employeeId: number): Promise<DeploymentGateResult> {
    const missing: string[] = [];
    const employee = await storage.getEmployee(employeeId);
    if (!employee) return { ok: false, missing: ["Employee not found"] };

    const step = employee.officerStep ?? 0;
    if (step < MIN_DEPLOY_STEP) {
      missing.push(`Officer step must be at least ${MIN_DEPLOY_STEP} (current: ${step})`);
    }

    if (!employee.nationalInsurance?.trim()) {
      missing.push("NI number required");
    }

    const immigration = await storage.getEmployeeImmigration(employeeId);
    const docs = await storage.getDocuments(employeeId);
    const hasPassportDoc = docs.some((d) =>
      ["passport", "passport_id", "identity", "proof_of_identity"].includes((d.documentType || "").toLowerCase())
    );
    if (!immigration?.passportDocNo && !hasPassportDoc) {
      missing.push("Passport / ID document required");
    }

    if (immigration?.shareCode) {
      if (immigration.shareCodeExpiry && new Date(immigration.shareCodeExpiry) < new Date()) {
        missing.push("Share code expired");
      }
    } else if (immigration?.visaNeeded || immigration?.brpNeeded) {
      missing.push("Share code required");
    }

    const hasPoa = docs.some((d) => POA_TYPES.includes((d.documentType || "").toLowerCase()));
    if (!hasPoa) {
      missing.push("Proof of address (utility bill or bank statement) required");
    }

    const siaLicences = await db.select().from(employeeSiaLicences).where(eq(employeeSiaLicences.employeeId, employeeId));
    const defaultSia = siaLicences.find((s) => s.isDefault) || siaLicences[0];
    const siaNumber = defaultSia?.siaNumber || employee.siaLicenseNumber;
    const siaExpiry = defaultSia?.expiryDate || employee.siaExpiryDate;
    if (!siaNumber) {
      missing.push("Valid SIA licence required");
    } else if (siaExpiry && new Date(siaExpiry) < new Date()) {
      missing.push("SIA licence expired");
    }

    const [pForm] = await db.select().from(pFormRecords).where(eq(pFormRecords.employeeId, employeeId)).limit(1);
    if (step <= 6) {
      if (!pForm || pForm.status !== "finished") {
        missing.push("P Form must be finished");
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

  async addVettingAudit(data: InsertVettingAuditEvent) {
    const payload: InsertVettingAuditEvent = {
      employeeId: data.employeeId,
      code: data.code,
      action: data.action,
      details: data.details ?? null,
      colorKey: data.colorKey ?? null,
      tenantId: data.tenantId ?? null,
      createdBy: data.createdBy || null,
    };
    // Avoid FK violations when tenant/user ids are missing or stale
    if (!payload.tenantId) delete (payload as any).tenantId;
    if (!payload.createdBy) delete (payload as any).createdBy;

    try {
      const [row] = await db.insert(vettingAuditEvents).values(payload).returning();
      return row;
    } catch (err: any) {
      // Retry without optional FKs if constraint fails
      if (err?.code === "23503") {
        const { tenantId: _t, createdBy: _c, ...safe } = payload as any;
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
};
