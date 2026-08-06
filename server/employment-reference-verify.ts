import crypto from "crypto";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  employmentReferenceTokens,
  employmentHistory,
  type EmploymentReferenceToken,
  type EmploymentHistory,
} from "@shared/schema";
import { staffProfileStorage } from "./staff-profile-storage";
import { generateEmploymentReferenceConfirmationPdf } from "./pdf-service";

const TOKEN_TTL_DAYS = 14;

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

export function buildEmploymentVerifyUrl(token: string): string {
  return `${appBaseUrl()}/verify/employment/${token}`;
}

export async function createEmploymentReferenceToken(params: {
  tenantId: number | null;
  employeeId: number;
  employmentHistoryId: number;
}): Promise<{ token: string; verifyUrl: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await db.insert(employmentReferenceTokens).values({
    token,
    tenantId: params.tenantId,
    employeeId: params.employeeId,
    employmentHistoryId: params.employmentHistoryId,
    expiresAt,
  });

  return { token, verifyUrl: buildEmploymentVerifyUrl(token), expiresAt };
}

async function loadTokenRow(token: string): Promise<EmploymentReferenceToken | undefined> {
  const [row] = await db
    .select()
    .from(employmentReferenceTokens)
    .where(eq(employmentReferenceTokens.token, token))
    .limit(1);
  return row;
}

export async function getEmploymentReferenceFormByToken(token: string) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid verification link", status: 404 };
  if (row.usedAt) {
    return { ok: false as const, error: "This verification form has already been submitted", status: 410, submitted: true };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This verification link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return { ok: false as const, error: "Employee not found", status: 404 };

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const histRows = await storage.getEmploymentHistory(row.employeeId);
  const hist = histRows.find((h) => h.id === row.employmentHistoryId);
  if (!hist) return { ok: false as const, error: "Employment record not found", status: 404 };

  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const companyName = (tenant?.tradingName || tenant?.name || "Company").trim();

  const addressParts = [
    employee.addressLine1,
    employee.addressLine2,
    employee.city,
    employee.county,
  ].filter(Boolean);

  return {
    ok: true as const,
    data: {
      companyName,
      applicantName: `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || "Applicant",
      dateOfBirth: employee.dateOfBirth || null,
      address: addressParts.join(", ") || null,
      postcode: employee.postcode || null,
      nationalInsurance: employee.nationalInsurance || null,
      appliedPosition: employee.jobTitle || "Security Officer",
      employerName: hist.employerName,
      statedRole: hist.jobTitle,
      dateFrom: hist.dateFrom,
      dateTo: hist.dateTo,
      expiresAt: row.expiresAt,
      alreadySubmitted: false,
    },
  };
}

export async function getSubmittedEmploymentReferenceHistoryIds(employeeId: number): Promise<Set<number>> {
  const rows = await db
    .select({ employmentHistoryId: employmentReferenceTokens.employmentHistoryId })
    .from(employmentReferenceTokens)
    .where(
      and(
        eq(employmentReferenceTokens.employeeId, employeeId),
        isNotNull(employmentReferenceTokens.usedAt),
      ),
    );
  return new Set(rows.map((r) => r.employmentHistoryId));
}

export async function getSubmittedEmploymentReferenceToken(
  employmentHistoryId: number,
): Promise<EmploymentReferenceToken | undefined> {
  const [row] = await db
    .select()
    .from(employmentReferenceTokens)
    .where(
      and(
        eq(employmentReferenceTokens.employmentHistoryId, employmentHistoryId),
        isNotNull(employmentReferenceTokens.usedAt),
      ),
    )
    .orderBy(desc(employmentReferenceTokens.id))
    .limit(1);
  return row;
}

export async function buildEmploymentReferenceConfirmationPdf(
  row: EmploymentReferenceToken,
  hist: EmploymentHistory,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!row.usedAt || !row.refereePrintName || !row.refereeSignature) return null;
  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return null;

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const applicantName = `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || "Applicant";
  const addressParts = [employee.addressLine1, employee.addressLine2, employee.city, employee.county].filter(Boolean);

  const buffer = await generateEmploymentReferenceConfirmationPdf({
    companyName: (tenant?.tradingName || tenant?.name || "Company").trim(),
    applicantName,
    dateOfBirth: employee.dateOfBirth || null,
    address: addressParts.join(", ") || null,
    postcode: employee.postcode || null,
    nationalInsurance: employee.nationalInsurance || null,
    appliedPosition: employee.jobTitle || "Security Officer",
    employerName: hist.employerName,
    statedRole: hist.jobTitle,
    dateFrom: hist.dateFrom,
    dateTo: hist.dateTo,
    informationConfirmed: !!row.informationConfirmed,
    detailsIfDifferent: row.detailsIfDifferent || null,
    confirmedFrom: hist.confirmedFrom || null,
    confirmedTo: hist.confirmedTo || null,
    attitude: (row.attitude as "good" | "average" | "poor") || "good",
    timeKeeping: (row.timeKeeping as "good" | "poor") || "good",
    timeOff: (row.timeOff as "average" | "more_than_average") || "average",
    reasonForLeaving: (row.reasonForLeaving as "own_accord" | "dismissed") || "own_accord",
    wouldReemploy: (row.wouldReemploy as "yes" | "no" | "cannot_comment") || "yes",
    refereePrintName: row.refereePrintName,
    refereeCompany: row.refereeCompany || "",
    refereePosition: row.refereePosition || "",
    refereeSignature: row.refereeSignature,
    submittedAt: row.usedAt,
  });

  const safeEmployer = hist.employerName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "Employer";
  return { buffer, filename: `REF02-Confirmation-${safeEmployer}.pdf` };
}

export type EmploymentReferenceSubmitBody = {
  informationConfirmed: boolean;
  detailsIfDifferent?: string | null;
  attitude: "good" | "average" | "poor";
  timeKeeping: "good" | "poor";
  timeOff: "average" | "more_than_average";
  reasonForLeaving: "own_accord" | "dismissed";
  wouldReemploy: "yes" | "no" | "cannot_comment";
  refereePrintName: string;
  refereeCompany: string;
  refereePosition: string;
  refereeSignature: string;
  confirmedFrom?: string | null;
  confirmedTo?: string | null;
};

export async function submitEmploymentReferenceForm(token: string, body: EmploymentReferenceSubmitBody) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid verification link", status: 404 };
  if (row.usedAt) return { ok: false as const, error: "This verification form has already been submitted", status: 410 };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This verification link has expired", status: 410 };
  }

  const printName = String(body.refereePrintName || "").trim();
  const company = String(body.refereeCompany || "").trim();
  const position = String(body.refereePosition || "").trim();
  const signature = String(body.refereeSignature || "").trim();
  if (!printName || !company || !position || !signature) {
    return { ok: false as const, error: "Referee name, company, position and signature are required", status: 400 };
  }

  const attitudeOk = ["good", "average", "poor"].includes(body.attitude);
  const timeKeepingOk = ["good", "poor"].includes(body.timeKeeping);
  const timeOffOk = ["average", "more_than_average"].includes(body.timeOff);
  const leavingOk = ["own_accord", "dismissed"].includes(body.reasonForLeaving);
  const reemployOk = ["yes", "no", "cannot_comment"].includes(body.wouldReemploy);
  if (!attitudeOk || !timeKeepingOk || !timeOffOk || !leavingOk || !reemployOk) {
    return { ok: false as const, error: "Invalid form selections", status: 400 };
  }

  const histRows = await storage.getEmploymentHistory(row.employeeId);
  const hist = histRows.find((h) => h.id === row.employmentHistoryId);
  if (!hist) return { ok: false as const, error: "Employment record not found", status: 404 };

  const confirmedFrom = body.confirmedFrom || hist.dateFrom;
  const confirmedTo = body.confirmedTo || hist.dateTo;

  const summary = [
    `Confirmed: ${body.informationConfirmed ? "YES" : "NO"}`,
    body.detailsIfDifferent?.trim() ? `Different details: ${body.detailsIfDifferent.trim()}` : null,
    `Attitude: ${body.attitude}`,
    `Time keeping: ${body.timeKeeping}`,
    `Time off: ${body.timeOff}`,
    `Left: ${body.reasonForLeaving === "own_accord" ? "own accord" : "dismissed"}`,
    `Re-employ: ${body.wouldReemploy}`,
    `Referee: ${printName} (${position}, ${company})`,
  ]
    .filter(Boolean)
    .join("; ");

  await db
    .update(employmentReferenceTokens)
    .set({
      usedAt: new Date(),
      informationConfirmed: !!body.informationConfirmed,
      detailsIfDifferent: body.detailsIfDifferent?.trim() || null,
      attitude: body.attitude,
      timeKeeping: body.timeKeeping,
      timeOff: body.timeOff,
      reasonForLeaving: body.reasonForLeaving,
      wouldReemploy: body.wouldReemploy,
      refereePrintName: printName,
      refereeCompany: company,
      refereePosition: position,
      refereeSignature: signature,
    })
    .where(and(eq(employmentReferenceTokens.id, row.id), isNull(employmentReferenceTokens.usedAt)));

  await storage.updateEmploymentHistory(hist.id, {
    verificationStatus: "verified",
    confirmedFrom: confirmedFrom || null,
    confirmedTo: confirmedTo || null,
    reasonForLeaving:
      body.reasonForLeaving === "dismissed" ? "Dismissed" : body.reasonForLeaving === "own_accord" ? "Own accord" : hist.reasonForLeaving,
    screeningComments: summary,
  });

  await staffProfileStorage.addVettingAudit({
    employeeId: row.employeeId,
    tenantId: row.tenantId,
    code: "WR",
    action: "Work reference",
    details: `Online employment reference received from ${printName} (${company}) for ${hist.employerName}: ${summary}`,
    colorKey: "maroon",
  });

  try {
    const updatedRow = await loadTokenRow(token);
    const updatedHist = { ...hist, confirmedFrom: confirmedFrom || null, confirmedTo: confirmedTo || null };
    if (updatedRow) {
      const pdf = await buildEmploymentReferenceConfirmationPdf(updatedRow, updatedHist);
      if (pdf) {
        await storage.createDocument({
          employeeId: row.employeeId,
          tenantId: row.tenantId,
          documentType: "employment_reference_confirmation",
          fileName: pdf.filename,
          fileUrl: `data:application/pdf;base64,${pdf.buffer.toString("base64")}`,
          fileSize: pdf.buffer.length,
          mimeType: "application/pdf",
          isVerified: true,
          verifiedAt: new Date(),
          notes: `Auto-generated from online employment reference confirmation submitted by ${printName} (${company}).`,
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[employment-reference-verify] Failed to generate confirmation PDF:", message);
  }

  return { ok: true as const };
}
