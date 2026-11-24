import { pool } from "../db";
import { sendViaTenantEmailSettings } from "../tenant-email-settings";
import { sendSMS } from "../twilio-service";
import { loadRecipientContacts } from "./officers";

export type BroadcastChannel = "email" | "sms";

const SEND_DELAY_MS = 250;
/** A broadcast left in "sending" longer than this (e.g. after a restart) no longer blocks new ones. */
const STALE_SENDING_MINUTES = 15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function bodyToHtml(body: string): string {
  const paragraphs = body.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${paragraphs.join("")}</div>`;
}

export async function hasActiveBroadcast(tenantId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM broadcast_messages
      WHERE tenant_id = $1 AND status = 'sending'
        AND updated_at > NOW() - INTERVAL '${STALE_SENDING_MINUTES} minutes'
      LIMIT 1`,
    [tenantId],
  );
  return rows.length > 0;
}

/**
 * Records the broadcast and one row per recipient. Officers without a usable
 * address for the channel are stored as failed so the sender can see who was skipped.
 */
export async function createBroadcast(params: {
  tenantId: number;
  userId: string;
  channel: BroadcastChannel;
  subject: string | null;
  body: string;
  employeeIds: number[];
  shiftId: number | null;
  siteId: number | null;
}): Promise<{ id: number; queued: number; skipped: number }> {
  const contacts = await loadRecipientContacts(params.tenantId, params.employeeIds);
  const recipients = contacts.map((c) => ({
    employeeId: c.employeeId,
    destination: params.channel === "email" ? c.email : c.phone,
  }));
  const queued = recipients.filter((r) => r.destination).length;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO broadcast_messages
         (tenant_id, shift_id, site_id, channel, subject, body, status, recipient_count, failed_count, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'sending', $7, $8, $9)
       RETURNING id`,
      [params.tenantId, params.shiftId, params.siteId, params.channel, params.subject, params.body,
        recipients.length, recipients.length - queued, params.userId],
    );
    const id = rows[0].id as number;
    if (recipients.length > 0) {
      await client.query(
        `INSERT INTO broadcast_recipients (broadcast_id, tenant_id, employee_id, channel, destination, status, error)
         SELECT $1, $2, v.employee_id, $3, COALESCE(v.destination, ''),
                CASE WHEN v.destination IS NULL THEN 'failed' ELSE 'pending' END,
                CASE WHEN v.destination IS NULL THEN $6 END
           FROM UNNEST($4::int[], $5::text[]) AS v(employee_id, destination)`,
        [id, params.tenantId, params.channel, recipients.map((r) => r.employeeId), recipients.map((r) => r.destination),
          params.channel === "email" ? "No valid email address" : "No valid mobile number"],
      );
    }
    await client.query("COMMIT");
    return { id, queued, skipped: recipients.length - queued };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function deliver(tenantId: number, channel: BroadcastChannel, to: string, subject: string | null, body: string): Promise<string | null> {
  if (channel === "email") {
    const result = await sendViaTenantEmailSettings({ tenantId, to, subject: subject || "Shift available", html: bodyToHtml(body) });
    return result.ok ? null : result.error || "Email failed";
  }
  const result = await sendSMS(to, body);
  return result.success ? null : result.error || "SMS failed";
}

/** Sends pending recipients sequentially; runs detached from the HTTP request. */
export async function processBroadcast(broadcastId: number, tenantId: number): Promise<void> {
  const { rows: [msg] } = await pool.query(
    `SELECT channel, subject, body FROM broadcast_messages WHERE id = $1 AND tenant_id = $2`,
    [broadcastId, tenantId],
  );
  if (!msg) return;

  const { rows: pending } = await pool.query<{ id: number; destination: string }>(
    `SELECT id, destination FROM broadcast_recipients
      WHERE broadcast_id = $1 AND status = 'pending' ORDER BY id`,
    [broadcastId],
  );

  for (const r of pending) {
    let error: string | null;
    try {
      error = await deliver(tenantId, msg.channel, r.destination, msg.subject, msg.body);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await pool.query(
      `UPDATE broadcast_recipients
          SET status = $2, error = $3, sent_at = CASE WHEN $2 = 'sent' THEN NOW() END, updated_at = NOW()
        WHERE id = $1`,
      [r.id, error ? "failed" : "sent", error ? error.slice(0, 500) : null],
    );
    await pool.query(
      `UPDATE broadcast_messages
          SET sent_count = sent_count + $2, failed_count = failed_count + $3, updated_at = NOW()
        WHERE id = $1`,
      [broadcastId, error ? 0 : 1, error ? 1 : 0],
    );
    await sleep(SEND_DELAY_MS);
  }

  await pool.query(
    `UPDATE broadcast_messages SET status = 'completed', updated_at = NOW() WHERE id = $1`,
    [broadcastId],
  );
}

export async function getBroadcastStatus(tenantId: number, broadcastId: number) {
  const { rows: [msg] } = await pool.query(
    `SELECT id, channel, subject, status, recipient_count, sent_count, failed_count, created_at
       FROM broadcast_messages WHERE id = $1 AND tenant_id = $2`,
    [broadcastId, tenantId],
  );
  if (!msg) return null;
  const { rows: failures } = await pool.query(
    `SELECT r.employee_id, TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS name, r.destination, r.error
       FROM broadcast_recipients r
       LEFT JOIN employees e ON e.id = r.employee_id
       LEFT JOIN users u ON u.id = e.user_id
      WHERE r.broadcast_id = $1 AND r.status = 'failed'
      ORDER BY r.id
      LIMIT 200`,
    [broadcastId],
  );
  return {
    id: msg.id,
    channel: msg.channel,
    subject: msg.subject,
    status: msg.status,
    recipientCount: msg.recipient_count,
    sentCount: msg.sent_count,
    failedCount: msg.failed_count,
    createdAt: msg.created_at,
    failures: failures.map((f: any) => ({ employeeId: f.employee_id, name: f.name, destination: f.destination, error: f.error })),
  };
}
