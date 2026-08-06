import crypto from "crypto";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  personalReferenceTokens,
  type PersonalReferenceToken,
  type Reference,
} from "@shared/schema";
import { staffProfileStorage } from "./staff-profile-storage";
import { generatePersonalReferenceConfirmationPdf } from "./pdf-service";

const TOKEN_TTL_DAYS = 14;

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

export function buildPersonalReferenceVerifyUrl(token: string): string {
  return `${appBaseUrl()}/verify/personal/${token}`;
}

export async function createPersonalReferenceToken(params: {
  tenantId: number | null;
  employeeId: number;
  referenceId: number;
}): Promise<{ token: string; verifyUrl: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await db.insert(personalReferenceTokens).values({
    token,
    tenantId: params.tenantId,
    employeeId: params.employeeId,
    referenceId: params.referenceId,
    expiresAt,
  });

  return { token, verifyUrl: buildPersonalReferenceVerifyUrl(token), expiresAt };
}

async function loadTokenRow(token: string): Promise<PersonalReferenceToken | undefined> {
  const [row] = await db
    .select()
    .from(personalReferenceTokens)
    .where(eq(personalReferenceTokens.token, token))
    .limit(1);
  return row;
}

export async function getPersonalReferenceFormByToken(token: string) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid verification link", status: 404 };
  if (row.usedAt) {
    return { ok: false as const, error: "This reference form has already been submitted", status: 410, submitted: true };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This verification link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return { ok: false as const, error: "Employee not found", status: 404 };

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const refRows = await storage.getReferences(row.employeeId);
  const ref = refRows.find((r) => r.id === row.referenceId);
  if (!ref) return { ok: false as const, error: "Reference record not found", status: 404 };

  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const companyName = (tenant?.tradingName || tenant?.name || "Company").trim();

  return {
    ok: true as const,
    data: {
      companyName,
      applicantName: `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || "Applicant",
      refereeName: ref.refereeName,
      refereeAddress: ref.refereeAddress || null,
      relationship: ref.relationship || null,
      howLongKnown: ref.howLongKnown || null,
      expiresAt: row.expiresAt,
      alreadySubmitted: false,
    },
  };
}

export type PersonalReferenceSubmitBody = {
  illegalActivity: "yes" | "no";
  honestPerson: "yes" | "no";
  politeConduct: "yes" | "no";
  ableToWorkInTeam: "yes" | "no";
  trustworthyAndLoyal: "yes" | "no";
  goodChoiceForPosition: "yes" | "no";
  reasonIfNo?: string | null;
  refereePrintName: string;
  refereeOccupation?: string | null;
  refereeAddress?: string | null;
  refereeSignature: string;
};

export async function getSubmittedPersonalReferenceIds(employeeId: number): Promise<Set<number>> {
  const rows = await db
    .select({ referenceId: personalReferenceTokens.referenceId })
    .from(personalReferenceTokens)
    .where(and(eq(personalReferenceTokens.employeeId, employeeId), isNotNull(personalReferenceTokens.usedAt)));
  return new Set(rows.map((r) => r.referenceId));
}

export async function getSubmittedPersonalReferenceToken(referenceId: number): Promise<PersonalReferenceToken | undefined> {
  const [row] = await db
    .select()
    .from(personalReferenceTokens)
    .where(and(eq(personalReferenceTokens.referenceId, referenceId), isNotNull(personalReferenceTokens.usedAt)))
    .orderBy(desc(personalReferenceTokens.id))
    .limit(1);
  return row;
}

export async function buildPersonalReferenceConfirmationPdf(
  row: PersonalReferenceToken,
  ref: Reference,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!row.usedAt || !row.refereePrintName || !row.refereeSignature) return null;
  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return null;

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const applicantName = `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || "Applicant";

  const buffer = await generatePersonalReferenceConfirmationPdf({
    companyName: (tenant?.tradingName || tenant?.name || "Company").trim(),
    applicantName,
    refereeName: ref.refereeName,
    refereeAddress: row.refereeAddress || ref.refereeAddress || null,
    relationship: ref.relationship,
    howLongKnown: ref.howLongKnown,
    illegalActivity: (row.illegalActivity as "yes" | "no") || "no",
    honestPerson: (row.honestPerson as "yes" | "no") || "yes",
    politeConduct: (row.politeConduct as "yes" | "no") || "yes",
    ableToWorkInTeam: (row.ableToWorkInTeam as "yes" | "no") || "yes",
    trustworthyAndLoyal: (row.trustworthyAndLoyal as "yes" | "no") || "yes",
    goodChoiceForPosition: (row.goodChoiceForPosition as "yes" | "no") || "yes",
    reasonIfNo: row.reasonIfNo || null,
    refereePrintName: row.refereePrintName,
    refereeOccupation: row.refereeOccupation || "",
    refereeSignature: row.refereeSignature,
    submittedAt: row.usedAt,
  });

  const safeReferee = ref.refereeName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "Referee";
  return { buffer, filename: `Personal-Reference-${safeReferee}.pdf` };
}

export async function submitPersonalReferenceForm(token: string, body: PersonalReferenceSubmitBody) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid verification link", status: 404 };
  if (row.usedAt) return { ok: false as const, error: "This reference form has already been submitted", status: 410 };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This verification link has expired", status: 410 };
  }

  const printName = String(body.refereePrintName || "").trim();
  const occupation = String(body.refereeOccupation || "").trim();
  const signature = String(body.refereeSignature || "").trim();
  if (!printName || !signature) {
    return { ok: false as const, error: "Referee name and signature are required", status: 400 };
  }

  const yesNoFields: Array<keyof PersonalReferenceSubmitBody> = [
    "illegalActivity",
    "honestPerson",
    "politeConduct",
    "ableToWorkInTeam",
    "trustworthyAndLoyal",
    "goodChoiceForPosition",
  ];
  for (const field of yesNoFields) {
    if (!["yes", "no"].includes(body[field] as string)) {
      return { ok: false as const, error: "Invalid form selections", status: 400 };
    }
  }

  const refRows = await storage.getReferences(row.employeeId);
  const ref = refRows.find((r) => r.id === row.referenceId);
  if (!ref) return { ok: false as const, error: "Reference record not found", status: 404 };

  const summary = [
    `Illegal activity: ${body.illegalActivity}`,
    `Honest: ${body.honestPerson}`,
    `Polite conduct: ${body.politeConduct}`,
    `Works well in team: ${body.ableToWorkInTeam}`,
    `Trustworthy and loyal: ${body.trustworthyAndLoyal}`,
    `Good choice for position: ${body.goodChoiceForPosition}${body.reasonIfNo?.trim() ? ` (${body.reasonIfNo.trim()})` : ""}`,
    `Referee: ${printName}${occupation ? ` (${occupation})` : ""}`,
  ].join("; ");

  await db
    .update(personalReferenceTokens)
    .set({
      usedAt: new Date(),
      illegalActivity: body.illegalActivity,
      honestPerson: body.honestPerson,
      politeConduct: body.politeConduct,
      ableToWorkInTeam: body.ableToWorkInTeam,
      trustworthyAndLoyal: body.trustworthyAndLoyal,
      goodChoiceForPosition: body.goodChoiceForPosition,
      reasonIfNo: body.reasonIfNo?.trim() || null,
      refereePrintName: printName,
      refereeOccupation: occupation || null,
      refereeAddress: body.refereeAddress?.trim() || null,
      refereeSignature: signature,
    })
    .where(and(eq(personalReferenceTokens.id, row.id), isNull(personalReferenceTokens.usedAt)));

  await storage.updateReference(ref.id, {
    verificationStatus: "verified",
    responseReceived: true,
    responseDate: new Date(),
    infoSupplied: true,
    screeningComments: summary,
  });

  await staffProfileStorage.addVettingAudit({
    employeeId: row.employeeId,
    tenantId: row.tenantId,
    code: "PR",
    action: "Personal reference",
    details: `Online personal reference received from ${printName}${occupation ? ` (${occupation})` : ""} for referee ${ref.refereeName}: ${summary}`,
    colorKey: "maroon",
  });

  try {
    const updatedRow = await loadTokenRow(token);
    if (updatedRow) {
      const pdf = await buildPersonalReferenceConfirmationPdf(updatedRow, ref);
      if (pdf) {
        await storage.createDocument({
          employeeId: row.employeeId,
          tenantId: row.tenantId,
          documentType: "personal_reference_confirmation",
          fileName: pdf.filename,
          fileUrl: `data:application/pdf;base64,${pdf.buffer.toString("base64")}`,
          fileSize: pdf.buffer.length,
          mimeType: "application/pdf",
          isVerified: true,
          verifiedAt: new Date(),
          notes: `Auto-generated from online personal reference confirmation submitted by ${printName}.`,
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[personal-reference-verify] Failed to generate confirmation PDF:", message);
  }

  return { ok: true as const };
}
