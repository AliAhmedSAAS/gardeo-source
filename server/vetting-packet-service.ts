import crypto from "crypto";
import JSZip from "jszip";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { vettingPacketTokens, type VettingPacketToken } from "@shared/schema";
import { generateVettingDocument, listAvailableVettingDocuments } from "./vetting-document-service";

const TOKEN_TTL_DAYS = 3;

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

export function buildVettingPacketUrl(token: string): string {
  return `${appBaseUrl()}/api/vetting-packets/${token}`;
}

export async function createVettingPacketToken(params: {
  tenantId: number | null;
  employeeId: number;
  recipientEmail: string;
  documentCodes: string[];
  createdBy?: string | null;
}): Promise<{ token: string; packetUrl: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await db.insert(vettingPacketTokens).values({
    token,
    tenantId: params.tenantId,
    employeeId: params.employeeId,
    recipientEmail: params.recipientEmail.trim(),
    documentCodes: params.documentCodes,
    expiresAt,
    createdBy: params.createdBy || null,
  });

  return { token, packetUrl: buildVettingPacketUrl(token), expiresAt };
}

async function loadTokenRow(token: string): Promise<VettingPacketToken | undefined> {
  const [row] = await db
    .select()
    .from(vettingPacketTokens)
    .where(eq(vettingPacketTokens.token, token))
    .limit(1);
  return row;
}

export async function getVettingPacketByToken(token: string) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid vetting packet link", status: 404 };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This vetting packet link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return { ok: false as const, error: "Employee not found", status: 404 };
  if (!employee.tenantId) return { ok: false as const, error: "Employee has no tenant assigned", status: 400 };

  const tenant = await storage.getTenant(employee.tenantId);
  if (!tenant) return { ok: false as const, error: "Tenant not found", status: 404 };

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const [emergencyContacts, bankDetails, employmentHistory, references] = await Promise.all([
    storage.getEmergencyContacts(row.employeeId),
    storage.getBankDetails(row.employeeId),
    storage.getEmploymentHistory(row.employeeId),
    storage.getReferences(row.employeeId),
  ]);

  const available = new Set(
    listAvailableVettingDocuments(employee.officerType)
      .filter((form) => form.downloadable)
      .map((form) => form.code),
  );

  const documentCodes = (Array.isArray(row.documentCodes) ? row.documentCodes : [])
    .map((code) => String(code || "").toLowerCase().trim())
    .filter((code) => code && available.has(code));

  if (documentCodes.length === 0) {
    return { ok: false as const, error: "No downloadable documents are available for this packet", status: 404 };
  }

  const zip = new JSZip();
  for (const code of documentCodes) {
    const result = await generateVettingDocument(
      code,
      tenant,
      { ...employee, emergencyContacts, bankDetails, employmentHistory, references },
      empUser,
    );
    zip.file(result.filename, result.buffer);
  }

  const employeeName =
    `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
    employee.employeeNumber ||
    `employee-${employee.id}`;
  const safeName = employeeName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

  return {
    ok: true as const,
    data: {
      filename: `Vetting-Documents-${safeName || employee.id}.zip`,
      contentType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
      expiresAt: row.expiresAt,
      recipientEmail: row.recipientEmail,
      documentCodes,
    },
  };
}
