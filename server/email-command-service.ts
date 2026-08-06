import { storage } from "./storage";
import { processEmail } from "./email-classifier";
import crypto from "crypto";

const activePollers = new Map<number, ReturnType<typeof setInterval>>();
const pollingLocks = new Set<number>();

const ENCRYPTION_KEY = process.env.JWT_SECRET || "gardeo-default-encryption-key-32b";

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptSecret(encryptedText: string): string {
  const parts = encryptedText.split(":");
  if (parts.length < 2) return encryptedText;
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts.slice(1).join(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function acquireAccessToken(clientId: string, clientSecret: string, azureTenantId: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[EmailCommand] Token acquisition failed:", response.status, errorText);
    throw new Error(`Failed to acquire access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function testEmailConnection(clientId: string, clientSecret: string, azureTenantId: string, userEmail?: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const accessToken = await acquireAccessToken(clientId, clientSecret, azureTenantId);

    const endpoint = userEmail
      ? `https://graph.microsoft.com/v1.0/users/${userEmail}/messages?$top=1&$select=id,subject`
      : `https://graph.microsoft.com/v1.0/users?$top=1&$select=mail,displayName`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (userEmail) {
      return { success: true, email: userEmail };
    }

    const firstUser = data.value?.[0];
    return { success: true, email: firstUser?.mail || "Connected successfully" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function fetchOutlookEmails(tenantId: number, userId: string, accessToken: string, userEmail?: string, maxResults = 20): Promise<number> {
  const userPath = userEmail ? `users/${userEmail}` : "me";
  const graphUrl = `https://graph.microsoft.com/v1.0/${userPath}/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,subject,from,bodyPreview,body,receivedDateTime,isRead&$filter=isRead eq false`;

  const response = await fetch(graphUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[EmailCommand] Graph API error:", response.status, errorText);
    throw new Error(`Microsoft Graph API error: ${response.status}`);
  }

  const data = await response.json();
  const messages = data.value || [];
  let newCount = 0;

  for (const msg of messages) {
    const existing = await storage.getInboxEmailByOutlookId(msg.id, tenantId);
    if (existing) continue;

    const bodyText = msg.body?.contentType === "text"
      ? msg.body.content
      : (msg.body?.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    await storage.createInboxEmail({
      tenantId,
      outlookMessageId: msg.id,
      fromAddress: msg.from?.emailAddress?.address || "unknown@unknown.com",
      fromName: msg.from?.emailAddress?.name || null,
      subject: msg.subject || null,
      bodyPreview: msg.bodyPreview || null,
      bodyText: bodyText.slice(0, 10000),
      receivedAt: new Date(msg.receivedDateTime),
      processingStatus: "unread",
    });

    newCount++;
  }

  return newCount;
}

export async function markEmailReadInOutlook(outlookMessageId: string, accessToken: string, userEmail?: string): Promise<void> {
  try {
    const userPath = userEmail ? `users/${userEmail}` : "me";
    await fetch(`https://graph.microsoft.com/v1.0/${userPath}/messages/${outlookMessageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EmailCommand] Failed to mark email as read:", message);
  }
}

export async function pollAndProcessEmails(tenantId: number, userId: string, accessToken?: string): Promise<{ fetched: number; processed: number }> {
  if (pollingLocks.has(tenantId)) return { fetched: 0, processed: 0 };
  pollingLocks.add(tenantId);

  try {
    let token = accessToken;
    let userEmail: string | undefined;

    if (!token) {
      const conn = await storage.getTenantEmailConnection(tenantId);
      if (!conn || conn.connectionStatus !== "connected") {
        throw new Error("No active email connection for this tenant");
      }
      const decryptedSecret = decryptSecret(conn.clientSecret);
      token = await acquireAccessToken(conn.clientId, decryptedSecret, conn.azureTenantId);
      userEmail = conn.connectedEmail || undefined;

      await storage.upsertTenantEmailConnection(tenantId, { lastPolledAt: new Date() });
    }

    const fetched = await fetchOutlookEmails(tenantId, userId, token, userEmail);
    console.log(`[EmailCommand] Fetched ${fetched} new emails for tenant ${tenantId}`);

    const unprocessed = await storage.getInboxEmails(tenantId, 50);
    const toProcess = unprocessed.filter(e => e.processingStatus === "unread");
    let processed = 0;

    for (const email of toProcess) {
      try {
        await processEmail(email.id, tenantId, userId);
        processed++;

        await markEmailReadInOutlook(email.outlookMessageId, token, userEmail);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[EmailCommand] Failed to process email ${email.id}:`, message);
      }
    }

    console.log(`[EmailCommand] Processed ${processed} emails for tenant ${tenantId}`);
    return { fetched, processed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const conn = await storage.getTenantEmailConnection(tenantId);
    if (conn) {
      await storage.upsertTenantEmailConnection(tenantId, {
        lastError: message,
        connectionStatus: message.includes("401") ? "error" : conn.connectionStatus,
      });
    }
    throw err;
  } finally {
    pollingLocks.delete(tenantId);
  }
}

export function startEmailPolling(tenantId: number, userId: string, accessToken?: string, intervalMs = 120000): void {
  stopEmailPolling(tenantId);

  console.log(`[EmailCommand] Starting email polling for tenant ${tenantId} (interval: ${intervalMs / 1000}s)`);

  pollAndProcessEmails(tenantId, userId, accessToken).catch(err => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EmailCommand] Initial poll failed:", message);
  });

  const interval = setInterval(() => {
    pollAndProcessEmails(tenantId, userId, accessToken).catch(err => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[EmailCommand] Poll cycle failed:", message);
    });
  }, intervalMs);

  activePollers.set(tenantId, interval);
}

export function stopEmailPolling(tenantId?: number): void {
  if (tenantId !== undefined) {
    const interval = activePollers.get(tenantId);
    if (interval) {
      clearInterval(interval);
      activePollers.delete(tenantId);
      console.log(`[EmailCommand] Polling stopped for tenant ${tenantId}`);
    }
  } else {
    for (const [tid, interval] of activePollers) {
      clearInterval(interval);
      console.log(`[EmailCommand] Polling stopped for tenant ${tid}`);
    }
    activePollers.clear();
  }
}

export async function sendTenantOutlookEmail(params: {
  tenantId: number;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string; from?: string }> {
  const conn = await storage.getTenantEmailConnection(params.tenantId);
  if (!conn || conn.connectionStatus !== "connected") {
    return {
      ok: false,
      error: "Tenant Outlook email is not connected. Connect it in Email Command Centre.",
    };
  }

  const mailbox = (conn.connectedEmail || "").trim();
  if (!mailbox) {
    return {
      ok: false,
      error: "Tenant email connection has no mailbox. Set Connected Email in Email Command Centre.",
    };
  }

  try {
    const decryptedSecret = decryptSecret(conn.clientSecret);
    const token = await acquireAccessToken(conn.clientId, decryptedSecret, conn.azureTenantId);

    const message: Record<string, unknown> = {
      subject: params.subject,
      body: { contentType: "HTML", content: params.html },
      toRecipients: [{ emailAddress: { address: params.to } }],
    };
    if (params.replyTo?.trim()) {
      message.replyTo = [{ emailAddress: { address: params.replyTo.trim() } }];
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EmailCommand] sendMail failed:", response.status, errorText);
      let detail = errorText;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed?.error?.message || errorText;
      } catch {
        /* keep raw */
      }
      await storage.upsertTenantEmailConnection(params.tenantId, {
        lastError: `sendMail ${response.status}: ${detail}`.slice(0, 1000),
      });
      return { ok: false, error: `Outlook send failed: ${detail}` };
    }

    return { ok: true, from: mailbox };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EmailCommand] sendTenantOutlookEmail failed:", message);
    return { ok: false, error: message };
  }
}

export function isEmailPollingActive(tenantId?: number): boolean {
  if (tenantId !== undefined) {
    return activePollers.has(tenantId);
  }
  return activePollers.size > 0;
}

export async function initializeEmailPolling(): Promise<void> {
  try {
    const connections = await storage.getAllActiveEmailConnections();
    console.log(`[EmailCommand] Found ${connections.length} active email connections to start polling`);

    for (const conn of connections) {
      try {
        const intervalMs = (conn.pollingIntervalMinutes || 2) * 60 * 1000;
        startEmailPolling(conn.tenantId, conn.connectedBy || "system", undefined, intervalMs);
        console.log(`[EmailCommand] Auto-started polling for tenant ${conn.tenantId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[EmailCommand] Failed to auto-start polling for tenant ${conn.tenantId}:`, message);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EmailCommand] Failed to initialize email polling:", message);
  }
}
