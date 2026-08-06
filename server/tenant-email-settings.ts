/**
 * Per-tenant email sending (SMTP primary, optional Resend key).
 * Passwords / API keys stored encrypted via the same helper as Outlook connections.
 */

import nodemailer from "nodemailer";
import { Resend } from "resend";
import { storage } from "./storage";
import { encryptSecret, decryptSecret } from "./email-command-service";
import type { TenantEmailSettings } from "@shared/schema";

export type PublicTenantEmailSettings = {
  enabled: boolean;
  provider: string;
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  hasResendApiKey: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastError: string | null;
  configured: boolean;
};

function isSmtpReady(row: TenantEmailSettings): boolean {
  return !!(
    row.enabled &&
    row.provider === "smtp" &&
    row.smtpHost?.trim() &&
    row.fromEmail?.trim() &&
    row.smtpPasswordEncrypted
  );
}

function isResendReady(row: TenantEmailSettings): boolean {
  return !!(
    row.enabled &&
    row.provider === "resend" &&
    row.fromEmail?.trim() &&
    row.resendApiKeyEncrypted
  );
}

export function toPublicTenantEmailSettings(row: TenantEmailSettings | undefined | null): PublicTenantEmailSettings {
  if (!row) {
    return {
      enabled: false,
      provider: "smtp",
      fromName: null,
      fromEmail: null,
      replyToEmail: null,
      smtpHost: null,
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: null,
      hasSmtpPassword: false,
      hasResendApiKey: false,
      lastTestedAt: null,
      lastTestStatus: null,
      lastError: null,
      configured: false,
    };
  }
  return {
    enabled: !!row.enabled,
    provider: row.provider || "smtp",
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyToEmail: row.replyToEmail,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort ?? 587,
    smtpSecure: !!row.smtpSecure,
    smtpUser: row.smtpUser,
    hasSmtpPassword: !!row.smtpPasswordEncrypted,
    hasResendApiKey: !!row.resendApiKeyEncrypted,
    lastTestedAt: row.lastTestedAt,
    lastTestStatus: row.lastTestStatus,
    lastError: row.lastError,
    configured: isSmtpReady(row) || isResendReady(row),
  };
}

export async function getPublicTenantEmailSettings(tenantId: number): Promise<PublicTenantEmailSettings> {
  const row = await storage.getTenantEmailSettings(tenantId);
  return toPublicTenantEmailSettings(row);
}

export type UpsertEmailSettingsInput = {
  enabled?: boolean;
  provider?: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  resendApiKey?: string | null;
  clearSmtpPassword?: boolean;
  clearResendApiKey?: boolean;
  updatedBy?: string;
};

export async function upsertTenantEmailSettings(
  tenantId: number,
  input: UpsertEmailSettingsInput,
): Promise<PublicTenantEmailSettings> {
  const existing = await storage.getTenantEmailSettings(tenantId);
  const data: Record<string, unknown> = {
    updatedBy: input.updatedBy || null,
  };

  if (input.enabled !== undefined) data.enabled = !!input.enabled;
  if (input.provider !== undefined) {
    const p = String(input.provider || "smtp").toLowerCase();
    data.provider = p === "resend" ? "resend" : "smtp";
  }
  if (input.fromName !== undefined) data.fromName = input.fromName?.trim() || null;
  if (input.fromEmail !== undefined) data.fromEmail = input.fromEmail?.trim() || null;
  if (input.replyToEmail !== undefined) data.replyToEmail = input.replyToEmail?.trim() || null;
  if (input.smtpHost !== undefined) data.smtpHost = input.smtpHost?.trim() || null;
  if (input.smtpPort !== undefined) {
    const port = input.smtpPort == null ? 587 : Number(input.smtpPort);
    data.smtpPort = Number.isFinite(port) ? port : 587;
  }
  if (input.smtpSecure !== undefined) data.smtpSecure = !!input.smtpSecure;
  if (input.smtpUser !== undefined) data.smtpUser = input.smtpUser?.trim() || null;

  if (input.clearSmtpPassword) {
    data.smtpPasswordEncrypted = null;
  } else if (typeof input.smtpPassword === "string" && input.smtpPassword.length > 0) {
    data.smtpPasswordEncrypted = encryptSecret(input.smtpPassword);
  }

  if (input.clearResendApiKey) {
    data.resendApiKeyEncrypted = null;
  } else if (typeof input.resendApiKey === "string" && input.resendApiKey.length > 0) {
    data.resendApiKeyEncrypted = encryptSecret(input.resendApiKey);
  }

  const saved = await storage.upsertTenantEmailSettings(tenantId, data as any);
  return toPublicTenantEmailSettings(saved);
}

function formatFrom(fromName: string | null | undefined, fromEmail: string): string {
  const name = (fromName || "").trim();
  if (!name) return fromEmail;
  return `${name} <${fromEmail}>`;
}

export async function sendViaTenantEmailSettings(params: {
  tenantId: number;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}): Promise<{ ok: boolean; error?: string; via?: "smtp" | "resend" }> {
  const row = await storage.getTenantEmailSettings(params.tenantId);
  if (!row || !row.enabled) {
    return { ok: false, error: "Tenant email settings are not enabled" };
  }

  const fromEmail = (row.fromEmail || "").trim();
  if (!fromEmail) {
    return { ok: false, error: "Tenant From email is not configured" };
  }

  const replyTo = (params.replyTo || row.replyToEmail || "").trim() || undefined;
  const from = formatFrom(row.fromName, fromEmail);

  if (row.provider === "resend") {
    if (!row.resendApiKeyEncrypted) {
      return { ok: false, error: "Tenant Resend API key is not configured" };
    }
    try {
      const apiKey = decryptSecret(row.resendApiKeyEncrypted);
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: [params.to],
        ...(replyTo ? { replyTo } : {}),
        subject: params.subject,
        html: params.html,
      });
      if (error) {
        await storage.upsertTenantEmailSettings(params.tenantId, {
          lastError: error.message.slice(0, 1000),
          lastTestStatus: "failed",
        });
        return { ok: false, error: error.message };
      }
      return { ok: true, via: "resend" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await storage.upsertTenantEmailSettings(params.tenantId, {
        lastError: message.slice(0, 1000),
        lastTestStatus: "failed",
      });
      return { ok: false, error: message };
    }
  }

  // Default: SMTP
  if (!row.smtpHost?.trim() || !row.smtpPasswordEncrypted) {
    return { ok: false, error: "Tenant SMTP host/password is not configured" };
  }

  try {
    const password = decryptSecret(row.smtpPasswordEncrypted);
    const port = row.smtpPort || 587;
    const secure = !!row.smtpSecure || port === 465;
    const transporter = nodemailer.createTransport({
      host: row.smtpHost.trim(),
      port,
      secure,
      auth: row.smtpUser?.trim()
        ? { user: row.smtpUser.trim(), pass: password }
        : undefined,
    });

    await transporter.sendMail({
      from,
      to: params.to,
      ...(replyTo ? { replyTo } : {}),
      subject: params.subject,
      html: params.html,
    });

    return { ok: true, via: "smtp" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tenant-email] SMTP send failed:", message);
    await storage.upsertTenantEmailSettings(params.tenantId, {
      lastError: message.slice(0, 1000),
      lastTestStatus: "failed",
    });
    return { ok: false, error: message };
  }
}

export async function testTenantEmailSettings(
  tenantId: number,
  to: string,
): Promise<{ ok: boolean; error?: string; via?: string }> {
  const result = await sendViaTenantEmailSettings({
    tenantId,
    to,
    subject: "Gardeo email settings test",
    html: "<p>This is a test email from your tenant SMTP / email settings. If you received it, configuration is working.</p>",
  });

  await storage.upsertTenantEmailSettings(tenantId, {
    lastTestedAt: new Date(),
    lastTestStatus: result.ok ? "ok" : "failed",
    lastError: result.ok ? null : (result.error || "Test failed").slice(0, 1000),
  });

  return result;
}
