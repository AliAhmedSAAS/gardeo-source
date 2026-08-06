/**
 * Email service using Resend API.
 * Used for supplier invitations, reminders, password resets, and admin notifications.
 * Set RESEND_API_KEY and RESEND_FROM in .env to enable sending; otherwise emails are no-op (invite/reset links still returned in API response).
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM || "Guardosmart <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

function isConfigured(): boolean {
  return !!resend;
}

export async function sendSupplierInvitation(params: {
  to: string;
  inviteLink: string;
  companyName?: string;
  contactName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, inviteLink, companyName = "Supplier", contactName } = params;
  const name = contactName || companyName;
  if (!resend) {
    console.warn("[email] Resend not configured (RESEND_API_KEY missing). Invitation email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: "You're invited to the Guardosmart Supplier Portal",
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>You have been invited to access the Guardosmart Supplier Portal.</p>
        <p>Click the link below to set your password and sign in. This link expires in 7 days.</p>
        <p><a href="${escapeHtml(inviteLink)}">Set password and access portal</a></p>
        <p>If you did not expect this email, you can ignore it.</p>
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendSupplierInvitation failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendSupplierReminder(params: {
  to: string;
  inviteLink: string;
  companyName?: string;
  contactName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, inviteLink, companyName = "Supplier", contactName } = params;
  const name = contactName || companyName;
  if (!resend) {
    console.warn("[email] Resend not configured. Reminder email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: "Reminder: Set up your Guardosmart Supplier Portal access",
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>This is a reminder that you have been invited to the Guardosmart Supplier Portal.</p>
        <p>Use the link below to set your password and sign in. This link expires in 7 days.</p>
        <p><a href="${escapeHtml(inviteLink)}">Set password and access portal</a></p>
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendSupplierReminder failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendSupplierPasswordReset(params: {
  to: string;
  resetLink: string;
  contactName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, resetLink, contactName = "there" } = params;
  if (!resend) {
    console.warn("[email] Resend not configured. Password reset email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: "Reset your Guardosmart Supplier Portal password",
      html: `
        <p>Hi ${escapeHtml(contactName)},</p>
        <p>A password reset was requested for your Guardosmart Supplier Portal account.</p>
        <p><a href="${escapeHtml(resetLink)}">Reset your password</a></p>
        <p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendSupplierPasswordReset failed:", message);
    return { ok: false, error: message };
  }
}

/** Notify supplier that a document was rejected with reason. */
export async function sendDocumentRejected(params: {
  to: string;
  contactName?: string;
  companyName?: string;
  documentTypeLabel: string;
  reason: string;
  portalBaseUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, contactName, companyName, documentTypeLabel, reason, portalBaseUrl } = params;
  const name = contactName || companyName || "there";
  if (!resend) {
    console.warn("[email] Resend not configured. Document rejected email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: "Document rejected – action required",
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>One of the documents you uploaded has been rejected and needs to be re-uploaded or corrected.</p>
        <p><strong>Document:</strong> ${escapeHtml(documentTypeLabel)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        ${portalBaseUrl ? `<p><a href="${escapeHtml(portalBaseUrl)}">Go to supplier portal to upload a new document</a></p>` : ""}
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendDocumentRejected failed:", message);
    return { ok: false, error: message };
  }
}

/** Notify supplier that admin requested a specific profile field. */
export async function sendSupplierFieldRequest(params: {
  to: string;
  contactName?: string;
  companyName?: string;
  fieldLabel: string;
  message?: string;
  portalBaseUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, contactName, companyName, fieldLabel, message, portalBaseUrl } = params;
  const name = contactName || companyName || "there";
  if (!resend) {
    console.warn("[email] Resend not configured. Field request email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Action required: Please provide ${fieldLabel}`,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>We need you to provide or update the following information in your supplier profile:</p>
        <p><strong>Field:</strong> ${escapeHtml(fieldLabel)}</p>
        ${message ? `<p><strong>Note:</strong> ${escapeHtml(message)}</p>` : ""}
        ${portalBaseUrl ? `<p><a href="${escapeHtml(portalBaseUrl)}">Go to supplier portal to update your profile</a></p>` : ""}
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendSupplierFieldRequest failed:", message);
    return { ok: false, error: message };
  }
}

/** Notify tenant admins/hr that a supplier has submitted changes for review. */
export async function sendAdminSupplierChangeNotification(params: {
  toEmails: string[];
  supplierName: string;
  supplierId: number;
  appBaseUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { toEmails, supplierName, supplierId, appBaseUrl } = params;
  if (toEmails.length === 0) return { ok: true };
  if (!resend) {
    console.warn("[email] Resend not configured. Admin notification not sent.");
    return { ok: true };
  }
  const reviewUrl = `${appBaseUrl.replace(/\/$/, "")}/suppliers/${supplierId}`;
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: toEmails,
      subject: `Supplier update: ${supplierName} has requested changes for review`,
      html: `
        <p>A supplier has submitted changes for your approval.</p>
        <p><strong>Supplier:</strong> ${escapeHtml(supplierName)} (ID: ${supplierId})</p>
        <p><a href="${escapeHtml(reviewUrl)}">Review and approve or reject</a></p>
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendAdminSupplierChangeNotification failed:", message);
    return { ok: false, error: message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Notify supplier that their profile change was approved or rejected. */
export async function sendSupplierChangeDecision(params: {
  to: string;
  contactName?: string;
  companyName?: string;
  approved: boolean;
  portalBaseUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, contactName, companyName, approved, portalBaseUrl } = params;
  const name = contactName || companyName || "there";
  if (!resend) {
    console.warn("[email] Resend not configured. Change decision email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: approved ? "Your profile changes have been approved" : "Your profile changes were not approved",
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>${approved ? "Your recent profile change request has been approved and applied to your supplier record." : "Your recent profile change request was not approved. Please contact us if you have questions or wish to resubmit."}</p>
        ${portalBaseUrl ? `<p><a href="${escapeHtml(portalBaseUrl)}">View your supplier portal</a></p>` : ""}
        <p>— Guardosmart</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendSupplierChangeDecision failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendComplianceAlert(params: {
  to: string;
  entityName: string;
  alertType: string;
  daysBefore: number;
  expiryDate: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, entityName, alertType, daysBefore, expiryDate } = params;
  const alertLabels: Record<string, string> = {
    sia_expiry: "SIA Licence",
    first_aid_expiry: "First Aid Certificate",
    dbs_review: "DBS Check Review",
    el_insurance_expiry: "Employer's Liability Insurance",
    pl_insurance_expiry: "Public Liability Insurance",
    sba_expiry: "Self-Billing Agreement",
    insurance_expiry: "Insurance Document",
  };
  const label = alertLabels[alertType] || alertType;
  const urgency = daysBefore <= 7 ? "URGENT" : daysBefore <= 14 ? "Important" : "Reminder";

  if (!resend) {
    console.warn(`[email] Resend not configured. Compliance alert (${label}, ${daysBefore} days) not sent to ${to}`);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `${urgency}: ${label} expiring in ${daysBefore} days — ${entityName}`,
      html: `
        <p>Hi,</p>
        <p>This is a compliance reminder from Guardosmart.</p>
        <p><strong>${escapeHtml(entityName)}</strong>'s <strong>${escapeHtml(label)}</strong> is due to expire on <strong>${escapeHtml(expiryDate)}</strong> (${daysBefore} days from now).</p>
        <p>Please take the necessary action to ensure continuity and compliance.</p>
        <p>— Guardosmart Compliance</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendComplianceAlert failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendOnboardingReminder(params: {
  to: string;
  employeeName: string;
  daysUntilDeadline: number;
  deadline: Date;
  onboardingLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, employeeName, daysUntilDeadline, deadline, onboardingLink } = params;
  const name = employeeName || "there";
  const deadlineStr = deadline.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  let subject: string;
  let urgencyText: string;

  if (daysUntilDeadline <= 0) {
    subject = "URGENT: Your onboarding is overdue – action required today";
    urgencyText = "Your onboarding deadline has passed. Please complete it immediately to avoid delays to your employment.";
  } else if (daysUntilDeadline === 1) {
    subject = "Reminder: Your onboarding is due tomorrow";
    urgencyText = "Your onboarding deadline is <strong>tomorrow</strong>. Please complete it today to avoid any issues.";
  } else {
    subject = `Reminder: ${daysUntilDeadline} days left to complete your onboarding`;
    urgencyText = `You have <strong>${daysUntilDeadline} days</strong> remaining to complete your onboarding (deadline: ${deadlineStr}).`;
  }

  if (!resend) {
    console.warn("[email] Resend not configured. Onboarding reminder not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>${urgencyText}</p>
        <p>Please log in and complete all required onboarding steps as soon as possible.</p>
        <p><a href="${escapeHtml(onboardingLink)}">Complete my onboarding</a></p>
        <p>If you have any questions, please contact your HR team.</p>
        <p>— Guardosmart HR</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendOnboardingReminder failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendOfferLetterEmail(params: {
  to: string;
  applicantName: string;
  jobTitle: string;
  companyName: string;
  pdfBuffer: Buffer;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, applicantName, jobTitle, companyName, pdfBuffer } = params;
  if (!resend) {
    console.warn("[email] Resend not configured. Offer letter email not sent to", to);
    return { ok: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Your Offer Letter — ${jobTitle} at ${companyName}`,
      html: `
        <p>Dear ${escapeHtml(applicantName)},</p>
        <p>Congratulations! We are delighted to offer you the position of <strong>${escapeHtml(jobTitle)}</strong> at ${escapeHtml(companyName)}.</p>
        <p>Please find your offer letter attached to this email. Kindly review it carefully, sign, and return a copy to us at your earliest convenience.</p>
        <p>If you have any questions about the offer, please do not hesitate to get in touch.</p>
        <p>We look forward to welcoming you to the team!</p>
        <p>— ${escapeHtml(companyName)}</p>
      `,
      attachments: [
        {
          filename: `Offer_Letter_${applicantName.replace(/\s+/g, "_")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendOfferLetterEmail failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendEmploymentReferenceRequest(params: {
  to: string;
  employerName: string;
  employeeName: string;
  jobTitle?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  companyName?: string;
  tradingName?: string | null;
  replyTo?: string | null;
  tenantEmail?: string | null;
  tenantId?: number | null;
  verifyUrl?: string | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean; via?: "smtp" | "resend" | "outlook" }> {
  const {
    to,
    employerName,
    employeeName,
    jobTitle = "Security Officer",
    dateFrom,
    dateTo,
    companyName = "Guardosmart",
    tradingName,
    replyTo,
    tenantEmail,
    tenantId,
    verifyUrl,
  } = params;
  const brand = (tradingName || companyName || "Guardosmart").trim();
  const reply = (replyTo || tenantEmail || "").trim() || undefined;

  const period =
    dateFrom || dateTo
      ? `<p>Employment period: ${escapeHtml(String(dateFrom || "N/A"))} – ${escapeHtml(String(dateTo || "Present"))}</p>`
      : "";

  const verifyBlock = verifyUrl
    ? `
        <p style="margin:24px 0;">
          <a href="${escapeHtml(verifyUrl)}"
             style="display:inline-block;background:#1F3A5F;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
            Verify employment online
          </a>
        </p>
        <p style="font-size:13px;color:#555;">
          Or open this link in your browser:<br/>
          <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a>
        </p>
        <p>The online form is confidential and takes a few minutes to complete.</p>
      `
    : `
        <p>Please reply to this email confirming:</p>
        <ul>
          <li>Dates of employment</li>
          <li>Job title / duties</li>
          <li>Reason for leaving (if known)</li>
          <li>Whether you would re-employ this person</li>
        </ul>
      `;

  const subject = `[${brand}] Employment reference request — ${employeeName}`;
  const html = `
        <p>Dear ${escapeHtml(employerName)},</p>
        <p><strong>${escapeHtml(brand)}</strong> is requesting an employment reference for
        <strong>${escapeHtml(employeeName)}</strong>, who listed your organisation as a previous employer
        (${escapeHtml(jobTitle)}).</p>
        ${period}
        ${verifyBlock}
        <p>Thank you for your assistance.</p>
        <p>— ${escapeHtml(brand)} Vetting Team${reply ? `<br/><span style="color:#666">${escapeHtml(reply)}</span>` : ""}</p>
      `;

  // 1) Per-tenant SMTP / Resend (Settings → Integrations)
  if (tenantId != null) {
    try {
      const { sendViaTenantEmailSettings } = await import("./tenant-email-settings");
      const tenantSend = await sendViaTenantEmailSettings({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (tenantSend.ok) {
        return { ok: true, via: tenantSend.via || "smtp" };
      }
      if (
        tenantSend.error &&
        !tenantSend.error.includes("not enabled") &&
        !tenantSend.error.includes("not configured")
      ) {
        return { ok: false, error: tenantSend.error };
      }
      console.warn("[email] Tenant SMTP/settings unavailable:", tenantSend.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant email settings error:", message);
    }
  }

  // 2) Tenant Outlook mailbox (Email Command Centre)
  if (tenantId != null) {
    try {
      const { sendTenantOutlookEmail } = await import("./email-command-service");
      const outlook = await sendTenantOutlookEmail({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (outlook.ok) {
        return { ok: true, via: "outlook" };
      }
      if (outlook.error && !outlook.error.includes("not connected") && !outlook.error.includes("no mailbox")) {
        return { ok: false, error: outlook.error };
      }
      console.warn("[email] Tenant Outlook unavailable:", outlook.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant Outlook send error:", message);
    }
  }

  if (!resend) {
    return {
      ok: false,
      error:
        "No tenant email configured. Set SMTP in Settings → Integrations, or connect Outlook in Email Command Centre.",
      skipped: true,
    };
  }

  // 3) Optional platform fallback via global Resend
  const from = fromAddress.includes("<")
    ? fromAddress.replace(/^[^<]*/, `${brand} Vetting `)
    : `${brand} Vetting <${fromAddress}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      ...(reply ? { replyTo: reply } : {}),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: "resend" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendEmploymentReferenceRequest failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendPersonalReferenceRequest(params: {
  to: string;
  refereeName: string;
  employeeName: string;
  relationship?: string | null;
  companyName?: string;
  tradingName?: string | null;
  replyTo?: string | null;
  tenantEmail?: string | null;
  tenantId?: number | null;
  verifyUrl?: string | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean; via?: "smtp" | "resend" | "outlook" }> {
  const {
    to,
    refereeName,
    employeeName,
    relationship,
    companyName = "Guardosmart",
    tradingName,
    replyTo,
    tenantEmail,
    tenantId,
    verifyUrl,
  } = params;
  const brand = (tradingName || companyName || "Guardosmart").trim();
  const reply = (replyTo || tenantEmail || "").trim() || undefined;

  const relationshipLine = relationship
    ? `<p>They have listed you as a personal reference (relationship: ${escapeHtml(relationship)}).</p>`
    : `<p>They have listed you as a personal reference.</p>`;

  const verifyBlock = verifyUrl
    ? `
        <p style="margin:24px 0;">
          <a href="${escapeHtml(verifyUrl)}"
             style="display:inline-block;background:#1F3A5F;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
            Complete reference online
          </a>
        </p>
        <p style="font-size:13px;color:#555;">
          Or open this link in your browser:<br/>
          <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a>
        </p>
        <p>The online form is confidential and takes a few minutes to complete.</p>
      `
    : `
        <p>Please reply to this email confirming:</p>
        <ul>
          <li>How long you have known ${escapeHtml(employeeName)}, and in what capacity</li>
          <li>Whether you would describe them as honest and trustworthy</li>
          <li>Whether you would recommend them for a position of trust</li>
        </ul>
      `;

  const subject = `[${brand}] Personal reference request — ${employeeName}`;
  const html = `
        <p>Dear ${escapeHtml(refereeName)},</p>
        <p><strong>${escapeHtml(brand)}</strong> is requesting a personal reference for
        <strong>${escapeHtml(employeeName)}</strong>, who has listed you as a referee.</p>
        ${relationshipLine}
        ${verifyBlock}
        <p>Thank you for your assistance.</p>
        <p>— ${escapeHtml(brand)} Vetting Team${reply ? `<br/><span style="color:#666">${escapeHtml(reply)}</span>` : ""}</p>
      `;

  // 1) Per-tenant SMTP / Resend (Settings → Integrations)
  if (tenantId != null) {
    try {
      const { sendViaTenantEmailSettings } = await import("./tenant-email-settings");
      const tenantSend = await sendViaTenantEmailSettings({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (tenantSend.ok) {
        return { ok: true, via: tenantSend.via || "smtp" };
      }
      if (
        tenantSend.error &&
        !tenantSend.error.includes("not enabled") &&
        !tenantSend.error.includes("not configured")
      ) {
        return { ok: false, error: tenantSend.error };
      }
      console.warn("[email] Tenant SMTP/settings unavailable:", tenantSend.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant email settings error:", message);
    }
  }

  // 2) Tenant Outlook mailbox (Email Command Centre)
  if (tenantId != null) {
    try {
      const { sendTenantOutlookEmail } = await import("./email-command-service");
      const outlook = await sendTenantOutlookEmail({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (outlook.ok) {
        return { ok: true, via: "outlook" };
      }
      if (outlook.error && !outlook.error.includes("not connected") && !outlook.error.includes("no mailbox")) {
        return { ok: false, error: outlook.error };
      }
      console.warn("[email] Tenant Outlook unavailable:", outlook.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant Outlook send error:", message);
    }
  }

  if (!resend) {
    return {
      ok: false,
      error:
        "No tenant email configured. Set SMTP in Settings → Integrations, or connect Outlook in Email Command Centre.",
      skipped: true,
    };
  }

  // 3) Optional platform fallback via global Resend
  const from = fromAddress.includes("<")
    ? fromAddress.replace(/^[^<]*/, `${brand} Vetting `)
    : `${brand} Vetting <${fromAddress}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      ...(reply ? { replyTo: reply } : {}),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: "resend" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendPersonalReferenceRequest failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendVettingPacketEmail(params: {
  to: string;
  employeeName: string;
  companyName?: string;
  tradingName?: string | null;
  replyTo?: string | null;
  tenantEmail?: string | null;
  tenantId?: number | null;
  packetUrl: string;
  documentLabels: string[];
  expiresAt: Date;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean; via?: "smtp" | "resend" | "outlook" }> {
  const {
    to,
    employeeName,
    companyName = "Guardosmart",
    tradingName,
    replyTo,
    tenantEmail,
    tenantId,
    packetUrl,
    documentLabels,
    expiresAt,
  } = params;
  const brand = (tradingName || companyName || "Guardosmart").trim();
  const reply = (replyTo || tenantEmail || "").trim() || undefined;
  const expiresLabel = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const docsHtml = documentLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join("");
  const subject = `[${brand}] Vetting documents for ${employeeName}`;
  const html = `
        <p>Hi ${escapeHtml(employeeName)},</p>
        <p>Please use the secure link below to download your vetting documents.</p>
        <ul>
          ${docsHtml}
        </ul>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(packetUrl)}"
             style="display:inline-block;background:#1F3A5F;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
            Download vetting documents
          </a>
        </p>
        <p style="font-size:13px;color:#555;">
          Or open this link in your browser:<br/>
          <a href="${escapeHtml(packetUrl)}">${escapeHtml(packetUrl)}</a>
        </p>
        <p>This secure link expires on <strong>${escapeHtml(expiresLabel)}</strong> (3 days).</p>
        <p>— ${escapeHtml(brand)} Vetting Team${reply ? `<br/><span style="color:#666">${escapeHtml(reply)}</span>` : ""}</p>
      `;

  if (tenantId != null) {
    try {
      const { sendViaTenantEmailSettings } = await import("./tenant-email-settings");
      const tenantSend = await sendViaTenantEmailSettings({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (tenantSend.ok) {
        return { ok: true, via: tenantSend.via || "smtp" };
      }
      if (
        tenantSend.error &&
        !tenantSend.error.includes("not enabled") &&
        !tenantSend.error.includes("not configured")
      ) {
        return { ok: false, error: tenantSend.error };
      }
      console.warn("[email] Tenant SMTP/settings unavailable:", tenantSend.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant email settings error:", message);
    }
  }

  if (tenantId != null) {
    try {
      const { sendTenantOutlookEmail } = await import("./email-command-service");
      const outlook = await sendTenantOutlookEmail({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (outlook.ok) {
        return { ok: true, via: "outlook" };
      }
      if (outlook.error && !outlook.error.includes("not connected") && !outlook.error.includes("no mailbox")) {
        return { ok: false, error: outlook.error };
      }
      console.warn("[email] Tenant Outlook unavailable:", outlook.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant Outlook send error:", message);
    }
  }

  if (!resend) {
    return {
      ok: false,
      error:
        "No tenant email configured. Set SMTP in Settings → Integrations, or connect Outlook in Email Command Centre.",
      skipped: true,
    };
  }

  const from = fromAddress.includes("<")
    ? fromAddress.replace(/^[^<]*/, `${brand} Vetting `)
    : `${brand} Vetting <${fromAddress}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      ...(reply ? { replyTo: reply } : {}),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: "resend" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendVettingPacketEmail failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendVettingFormLinkEmail(params: {
  to: string;
  employeeName: string;
  companyName?: string;
  tradingName?: string | null;
  replyTo?: string | null;
  tenantEmail?: string | null;
  tenantId?: number | null;
  formUrl: string;
  expiresAt: Date;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean; via?: "smtp" | "resend" | "outlook" }> {
  const {
    to,
    employeeName,
    companyName = "Guardosmart",
    tradingName,
    replyTo,
    tenantEmail,
    tenantId,
    formUrl,
    expiresAt,
  } = params;
  const brand = (tradingName || companyName || "Guardosmart").trim();
  const reply = (replyTo || tenantEmail || "").trim() || undefined;
  const expiresLabel = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const subject = `[${brand}] Complete your vetting application form`;
  const html = `
        <p>Hi ${escapeHtml(employeeName)},</p>
        <p>Please complete your vetting application using the secure link below. You can save your progress and return to edit until the link expires.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(formUrl)}"
             style="display:inline-block;background:#1F3A5F;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
            Open application form
          </a>
        </p>
        <p style="font-size:13px;color:#555;">
          Or open this link in your browser:<br/>
          <a href="${escapeHtml(formUrl)}">${escapeHtml(formUrl)}</a>
        </p>
        <p>This includes your Application Form, Equal Ops Review, Zero Hours Contract, and Code of Conduct acknowledgements.</p>
        <p>This secure link expires on <strong>${escapeHtml(expiresLabel)}</strong> (3 days).</p>
        <p>— ${escapeHtml(brand)} Vetting Team${reply ? `<br/><span style="color:#666">${escapeHtml(reply)}</span>` : ""}</p>
      `;

  if (tenantId != null) {
    try {
      const { sendViaTenantEmailSettings } = await import("./tenant-email-settings");
      const tenantSend = await sendViaTenantEmailSettings({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (tenantSend.ok) {
        return { ok: true, via: tenantSend.via || "smtp" };
      }
      if (
        tenantSend.error &&
        !tenantSend.error.includes("not enabled") &&
        !tenantSend.error.includes("not configured")
      ) {
        return { ok: false, error: tenantSend.error };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant email settings error:", message);
    }
  }

  if (tenantId != null) {
    try {
      const { sendTenantOutlookEmail } = await import("./email-command-service");
      const outlook = await sendTenantOutlookEmail({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (outlook.ok) {
        return { ok: true, via: "outlook" };
      }
      if (outlook.error && !outlook.error.includes("not connected") && !outlook.error.includes("no mailbox")) {
        return { ok: false, error: outlook.error };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant Outlook send error:", message);
    }
  }

  if (!resend) {
    return {
      ok: false,
      error:
        "No tenant email configured. Set SMTP in Settings → Integrations, or connect Outlook in Email Command Centre.",
      skipped: true,
    };
  }

  const from = fromAddress.includes("<")
    ? fromAddress.replace(/^[^<]*/, `${brand} Vetting `)
    : `${brand} Vetting <${fromAddress}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      ...(reply ? { replyTo: reply } : {}),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: "resend" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendVettingFormLinkEmail failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendDocumentRequestEmail(params: {
  to: string;
  employeeName: string;
  companyName?: string;
  tradingName?: string | null;
  replyTo?: string | null;
  tenantEmail?: string | null;
  tenantId?: number | null;
  documentTypeLabels: string[];
  message?: string | null;
  myDocumentsUrl: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean; via?: "smtp" | "resend" | "outlook" }> {
  const {
    to,
    employeeName,
    companyName = "Guardosmart",
    tradingName,
    replyTo,
    tenantEmail,
    tenantId,
    documentTypeLabels,
    message,
    myDocumentsUrl,
  } = params;
  const brand = (tradingName || companyName || "Guardosmart").trim();
  const reply = (replyTo || tenantEmail || "").trim() || undefined;
  const subject =
    documentTypeLabels.length === 1
      ? `[${brand}] Action required: Please upload ${documentTypeLabels[0]}`
      : `[${brand}] Action required: Please upload ${documentTypeLabels.length} documents`;
  const docsHtml = documentTypeLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join("");
  const html = `
        <p>Hi ${escapeHtml(employeeName)},</p>
        <p>We need you to upload the following document${documentTypeLabels.length > 1 ? "s" : ""} to your employee portal:</p>
        <ul>${docsHtml}</ul>
        ${message ? `<p><strong>Note from HR:</strong> ${escapeHtml(message)}</p>` : ""}
        <p style="margin:24px 0;">
          <a href="${escapeHtml(myDocumentsUrl)}"
             style="display:inline-block;background:#1F3A5F;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
            Go to My Documents
          </a>
        </p>
        <p style="font-size:13px;color:#555;">
          Or open this link in your browser:<br/>
          <a href="${escapeHtml(myDocumentsUrl)}">${escapeHtml(myDocumentsUrl)}</a>
        </p>
        <p>Please log in and upload ${documentTypeLabels.length > 1 ? "these documents" : "this document"} as soon as possible to stay compliant.</p>
        <p>— ${escapeHtml(brand)} HR Team${reply ? `<br/><span style="color:#666">${escapeHtml(reply)}</span>` : ""}</p>
      `;

  if (tenantId != null) {
    try {
      const { sendViaTenantEmailSettings } = await import("./tenant-email-settings");
      const tenantSend = await sendViaTenantEmailSettings({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (tenantSend.ok) {
        return { ok: true, via: tenantSend.via || "smtp" };
      }
      if (
        tenantSend.error &&
        !tenantSend.error.includes("not enabled") &&
        !tenantSend.error.includes("not configured")
      ) {
        return { ok: false, error: tenantSend.error };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant email settings error:", message);
    }
  }

  if (tenantId != null) {
    try {
      const { sendTenantOutlookEmail } = await import("./email-command-service");
      const outlook = await sendTenantOutlookEmail({
        tenantId,
        to,
        subject,
        html,
        replyTo: reply,
      });
      if (outlook.ok) {
        return { ok: true, via: "outlook" };
      }
      if (outlook.error && !outlook.error.includes("not connected") && !outlook.error.includes("no mailbox")) {
        return { ok: false, error: outlook.error };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[email] Tenant Outlook send error:", message);
    }
  }

  if (!resend) {
    return {
      ok: false,
      error:
        "No tenant email configured. Set SMTP in Settings → Integrations, or connect Outlook in Email Command Centre.",
      skipped: true,
    };
  }

  const from = fromAddress.includes("<")
    ? fromAddress.replace(/^[^<]*/, `${brand} HR `)
    : `${brand} HR <${fromAddress}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      ...(reply ? { replyTo: reply } : {}),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: "resend" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendDocumentRequestEmail failed:", message);
    return { ok: false, error: message };
  }
}

export const emailService = {
  isConfigured,
  sendSupplierInvitation,
  sendSupplierReminder,
  sendSupplierPasswordReset,
  sendDocumentRejected,
  sendSupplierFieldRequest,
  sendSupplierChangeDecision,
  sendAdminSupplierChangeNotification,
  sendComplianceAlert,
  sendOnboardingReminder,
  sendOfferLetterEmail,
  sendEmploymentReferenceRequest,
  sendPersonalReferenceRequest,
  sendVettingPacketEmail,
  sendVettingFormLinkEmail,
  sendDocumentRequestEmail,
};
