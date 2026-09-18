import crypto from "crypto";
import fs from "fs";
import path from "path";
import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { staffFeedbackTokens, type StaffFeedbackToken } from "@shared/schema";
import { staffProfileStorage } from "./staff-profile-storage";
import {
  generateStaffFeedbackQuestionnairePdf,
  STAFF_FEEDBACK_QUESTIONS,
  STAFF_FEEDBACK_RATINGS,
} from "./pdf-service";

const TOKEN_TTL_DAYS = 14;
const RATING_VALUES = new Set(STAFF_FEEDBACK_RATINGS.map((r) => r.value));
const QUESTION_KEYS = STAFF_FEEDBACK_QUESTIONS.map((q) => q.key);

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

export function buildStaffFeedbackUrl(token: string): string {
  return `${appBaseUrl()}/feedback/${token}`;
}

async function nextIssueNumber(employeeId: number): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${staffFeedbackTokens.issueNumber}), 0)` })
    .from(staffFeedbackTokens)
    .where(and(eq(staffFeedbackTokens.employeeId, employeeId), isNotNull(staffFeedbackTokens.usedAt)));
  return Number(row?.max || 0) + 1;
}

export async function createStaffFeedbackToken(params: {
  tenantId: number | null;
  employeeId: number;
}): Promise<{ token: string; verifyUrl: string; expiresAt: Date; issueNumber: number }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);
  const issueNumber = await nextIssueNumber(params.employeeId);

  await db.insert(staffFeedbackTokens).values({
    token,
    tenantId: params.tenantId,
    employeeId: params.employeeId,
    expiresAt,
    issueNumber,
  });

  return { token, verifyUrl: buildStaffFeedbackUrl(token), expiresAt, issueNumber };
}

async function loadTokenRow(token: string): Promise<StaffFeedbackToken | undefined> {
  const [row] = await db
    .select()
    .from(staffFeedbackTokens)
    .where(eq(staffFeedbackTokens.token, token))
    .limit(1);
  return row;
}

export async function getStaffFeedbackFormByToken(token: string) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid feedback link", status: 404 };
  if (row.usedAt) {
    return { ok: false as const, error: "This feedback form has already been submitted", status: 410, submitted: true };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This feedback link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return { ok: false as const, error: "Employee not found", status: 404 };
  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const officerName = `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || "Officer";
  const companyName = (tenant?.tradingName || tenant?.name || "Company").trim();

  return {
    ok: true as const,
    data: {
      companyName,
      officerName,
      issueNumber: row.issueNumber,
      expiresAt: row.expiresAt,
      questions: STAFF_FEEDBACK_QUESTIONS,
      ratings: STAFF_FEEDBACK_RATINGS,
      alreadySubmitted: false,
    },
  };
}

export type StaffFeedbackSubmitBody = {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string;
  q7: string;
  q8: string;
  q9: string;
  comments?: string | null;
  printName: string;
  signature: string;
};

function writePdfToUploads(buffer: Buffer): string {
  const uploadsDir = path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const safeName = `${crypto.randomUUID()}.pdf`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
  return `/objects/uploads/${safeName}`;
}

export async function submitStaffFeedbackForm(token: string, body: StaffFeedbackSubmitBody) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid feedback link", status: 404 };
  if (row.usedAt) return { ok: false as const, error: "This feedback form has already been submitted", status: 410 };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This feedback link has expired", status: 410 };
  }

  const ratings: StaffFeedbackSubmitBody = {
    q1: String(body.q1 || ""),
    q2: String(body.q2 || ""),
    q3: String(body.q3 || ""),
    q4: String(body.q4 || ""),
    q5: String(body.q5 || ""),
    q6: String(body.q6 || ""),
    q7: String(body.q7 || ""),
    q8: String(body.q8 || ""),
    q9: String(body.q9 || ""),
    printName: String(body.printName || "").trim(),
    signature: String(body.signature || "").trim(),
    comments: body.comments,
  };

  if (QUESTION_KEYS.some((key) => !RATING_VALUES.has(String(ratings[key] || "")))) {
    return { ok: false as const, error: "Please answer every question", status: 400 };
  }
  const comments = String(body.comments || "").trim();
  const hasPoor = QUESTION_KEYS.some((key) => ratings[key] === "poor" || ratings[key] === "very_poor");
  if (hasPoor && !comments) {
    return { ok: false as const, error: "Please add comments for Poor or Very poor ratings", status: 400 };
  }
  if (!ratings.printName || !ratings.signature) {
    return { ok: false as const, error: "Print name and signature are required", status: 400 };
  }

  const usedAt = new Date();
  await db
    .update(staffFeedbackTokens)
    .set({
      usedAt,
      q1: ratings.q1,
      q2: ratings.q2,
      q3: ratings.q3,
      q4: ratings.q4,
      q5: ratings.q5,
      q6: ratings.q6,
      q7: ratings.q7,
      q8: ratings.q8,
      q9: ratings.q9,
      comments: comments || null,
      printName: ratings.printName,
      signature: ratings.signature,
    })
    .where(and(eq(staffFeedbackTokens.id, row.id), isNull(staffFeedbackTokens.usedAt)));

  await staffProfileStorage.addVettingAudit({
    employeeId: row.employeeId,
    tenantId: row.tenantId,
    code: "FB",
    action: "Feedback questionnaire submitted",
    details: `Security Personnel Feedback Questionnaire (issue ${row.issueNumber}) submitted by ${ratings.printName}`,
    colorKey: "teal",
  });

  try {
    const employee = await storage.getEmployee(row.employeeId);
    const empUser = employee?.userId ? await storage.getUser(employee.userId) : null;
    const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
    const officerName =
      `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() || ratings.printName;
    const signedDate = usedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const previous = await db
      .select({ usedAt: staffFeedbackTokens.usedAt })
      .from(staffFeedbackTokens)
      .where(
        and(
          eq(staffFeedbackTokens.employeeId, row.employeeId),
          isNotNull(staffFeedbackTokens.usedAt),
          ne(staffFeedbackTokens.id, row.id),
        ),
      )
      .orderBy(desc(staffFeedbackTokens.usedAt))
      .limit(1);
    const lastSurveyDate = previous[0]?.usedAt
      ? previous[0].usedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";

    const buffer = await generateStaffFeedbackQuestionnairePdf({
      companyName: (tenant?.tradingName || tenant?.name || "Company").trim(),
      officerName,
      issueNumber: row.issueNumber,
      lastSurveyDate,
      conductedBy: tenant?.hrSignatoryName || null,
      reviewedBy: tenant?.hrSignatoryName || null,
      signedDate,
      ratings: {
        q1: ratings.q1,
        q2: ratings.q2,
        q3: ratings.q3,
        q4: ratings.q4,
        q5: ratings.q5,
        q6: ratings.q6,
        q7: ratings.q7,
        q8: ratings.q8,
        q9: ratings.q9,
      },
      comments,
      printName: ratings.printName,
      signatureImage: ratings.signature,
      submittedAt: usedAt,
    });
    const safeName = officerName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || String(row.employeeId);
    const fileName = `IMS-SE-18-Feedback-${safeName}-issue-${row.issueNumber}.pdf`;
    await storage.createDocument({
      employeeId: row.employeeId,
      tenantId: row.tenantId,
      documentType: "staff_feedback",
      fileName,
      fileUrl: writePdfToUploads(buffer),
      fileSize: buffer.length,
      mimeType: "application/pdf",
      isVerified: true,
      verifiedAt: usedAt,
      notes: `Security Personnel Feedback Questionnaire (IMS SE 18) issue ${row.issueNumber}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-feedback] Failed to generate PDF:", message);
  }

  return { ok: true as const };
}
