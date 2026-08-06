import { pool } from "./db";
import { sendSMS, isTwilioConfigured, makeVoiceCall, generateTwiML } from "./twilio-service";
import { generateCallScript, isElevenLabsConfigured } from "./elevenlabs-service";

interface ContactTarget {
  employeeId: number;
  employeeName: string;
  employeePhone?: string | null;
  employeeEmail?: string | null;
  shiftId?: number;
  siteName?: string;
  shiftDate?: string;
  shiftTime?: string;
  tenantId: number;
}

interface ContactResult {
  channel: string;
  status: "sent" | "failed" | "mock";
  sid?: string;
  error?: string;
  message?: string;
}

async function logContact(params: {
  tenantId: number;
  shiftId?: number;
  employeeId?: number;
  employeeName?: string;
  employeePhone?: string;
  employeeEmail?: string;
  channel: string;
  triggerType: string;
  subject?: string;
  messageBody?: string;
  status: string;
  errorMessage?: string;
  twilioSid?: string;
  escalationLevel?: number;
  triggeredBy?: string;
  siteName?: string;
  shiftDate?: string;
  shiftTime?: string;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO contact_logs (tenant_id, shift_id, employee_id, employee_name, employee_phone, employee_email, channel, trigger_type, subject, message_body, status, error_message, twilio_sid, escalation_level, triggered_by, site_name, shift_date, shift_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
    [
      params.tenantId, params.shiftId || null, params.employeeId || null,
      params.employeeName || null, params.employeePhone || null, params.employeeEmail || null,
      params.channel, params.triggerType, params.subject || null, params.messageBody || null,
      params.status, params.errorMessage || null, params.twilioSid || null,
      params.escalationLevel || 1, params.triggeredBy || "ai_controller",
      params.siteName || null, params.shiftDate || null, params.shiftTime || null,
    ]
  );
  return result.rows[0].id;
}

export async function sendInAppMessage(target: ContactTarget, message: string, triggerType: string): Promise<ContactResult> {
  try {
    const logId = await logContact({
      tenantId: target.tenantId,
      shiftId: target.shiftId,
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      employeePhone: target.employeePhone || undefined,
      channel: "in_app",
      triggerType,
      subject: `AI Controller: ${triggerType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`,
      messageBody: message,
      status: "sent",
      siteName: target.siteName,
      shiftDate: target.shiftDate,
      shiftTime: target.shiftTime,
    });

    console.log(`[AI Contact] In-app message sent to ${target.employeeName} (log #${logId})`);
    return { channel: "in_app", status: "sent", message };
  } catch (err: any) {
    console.error("[AI Contact] In-app message failed:", err.message);
    return { channel: "in_app", status: "failed", error: err.message };
  }
}

export async function sendSMSToEmployee(target: ContactTarget, message: string, triggerType: string): Promise<ContactResult> {
  if (!target.employeePhone) {
    await logContact({
      tenantId: target.tenantId,
      shiftId: target.shiftId,
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      channel: "sms",
      triggerType,
      messageBody: message,
      status: "failed",
      errorMessage: "No phone number on file",
      siteName: target.siteName,
      shiftDate: target.shiftDate,
      shiftTime: target.shiftTime,
    });
    return { channel: "sms", status: "failed", error: "No phone number on file" };
  }

  const result = await sendSMS(target.employeePhone, message);

  await logContact({
    tenantId: target.tenantId,
    shiftId: target.shiftId,
    employeeId: target.employeeId,
    employeeName: target.employeeName,
    employeePhone: target.employeePhone,
    channel: "sms",
    triggerType,
    messageBody: message,
    status: result.success ? "sent" : "failed",
    errorMessage: result.error,
    twilioSid: result.sid,
    siteName: target.siteName,
    shiftDate: target.shiftDate,
    shiftTime: target.shiftTime,
  });

  return {
    channel: "sms",
    status: result.success ? "sent" : "failed",
    sid: result.sid,
    error: result.error,
  };
}

export async function callEmployee(
  target: ContactTarget,
  triggerType: "late_checkin" | "no_show" | "shift_cover" | "general",
  baseUrl: string
): Promise<ContactResult> {
  if (!target.employeePhone) {
    await logContact({
      tenantId: target.tenantId,
      shiftId: target.shiftId,
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      channel: "voice_call",
      triggerType,
      status: "failed",
      errorMessage: "No phone number on file",
      siteName: target.siteName,
      shiftDate: target.shiftDate,
      shiftTime: target.shiftTime,
    });
    return { channel: "voice_call", status: "failed", error: "No phone number on file" };
  }

  const script = generateCallScript({
    employeeName: target.employeeName,
    siteName: target.siteName || "the assigned site",
    shiftTime: target.shiftTime || "the scheduled time",
    triggerType,
  });

  const twimlUrl = `${baseUrl}/api/ai-contact/twiml?employeeName=${encodeURIComponent(target.employeeName)}&siteName=${encodeURIComponent(target.siteName || "")}&shiftTime=${encodeURIComponent(target.shiftTime || "")}&triggerType=${triggerType}&shiftId=${target.shiftId || ""}&tenantId=${target.tenantId}`;

  const result = await makeVoiceCall(target.employeePhone, twimlUrl);

  await logContact({
    tenantId: target.tenantId,
    shiftId: target.shiftId,
    employeeId: target.employeeId,
    employeeName: target.employeeName,
    employeePhone: target.employeePhone,
    channel: "voice_call",
    triggerType,
    messageBody: script,
    status: result.success ? "sent" : "failed",
    errorMessage: result.error,
    twilioSid: result.sid,
    escalationLevel: 3,
    siteName: target.siteName,
    shiftDate: target.shiftDate,
    shiftTime: target.shiftTime,
  });

  return {
    channel: "voice_call",
    status: result.success ? "sent" : "failed",
    sid: result.sid,
    error: result.error,
    message: script,
  };
}

export async function escalatingContact(
  target: ContactTarget,
  triggerType: "late_checkin" | "no_show" | "shift_cover" | "general",
  baseUrl: string,
  channels: ("in_app" | "sms" | "voice_call")[] = ["in_app", "sms", "voice_call"]
): Promise<ContactResult[]> {
  const results: ContactResult[] = [];

  const smsMessages: Record<string, string> = {
    late_checkin: `GARDEO ALERT: Hi ${target.employeeName.split(" ")[0]}, you haven't checked in for your ${target.shiftTime || ""} shift at ${target.siteName || "your site"}. Please check in via the app immediately or call the control room.`,
    no_show: `URGENT - GARDEO: ${target.employeeName.split(" ")[0]}, you were expected at ${target.siteName || "your site"} at ${target.shiftTime || "the scheduled time"} but have not arrived. Please respond immediately or call the control room.`,
    shift_cover: `GARDEO: Hi ${target.employeeName.split(" ")[0]}, we have an urgent shift at ${target.siteName || "a site"} starting ${target.shiftTime || "soon"} that needs covering. Reply YES if you can cover or NO if unavailable.`,
    general: `GARDEO: Hi ${target.employeeName.split(" ")[0]}, the control room needs to reach you regarding your shift at ${target.siteName || "your site"}. Please check the app or call back.`,
  };

  const inAppMessages: Record<string, string> = {
    late_checkin: `You haven't checked in for your ${target.shiftTime || ""} shift at ${target.siteName || "your site"}. Please check in immediately.`,
    no_show: `URGENT: You were expected at ${target.siteName || "your site"} at ${target.shiftTime || "the scheduled time"} but have not arrived. Please contact the control room immediately.`,
    shift_cover: `An urgent shift at ${target.siteName || "a site"} starting ${target.shiftTime || "soon"} needs covering. Are you available?`,
    general: `The control room needs to reach you regarding your shift at ${target.siteName || "your site"}. Please respond.`,
  };

  for (const channel of channels) {
    try {
      if (channel === "in_app") {
        const result = await sendInAppMessage(target, inAppMessages[triggerType], triggerType);
        results.push(result);
      } else if (channel === "sms") {
        const result = await sendSMSToEmployee(target, smsMessages[triggerType], triggerType);
        results.push(result);
      } else if (channel === "voice_call") {
        const result = await callEmployee(target, triggerType, baseUrl);
        results.push(result);
      }
    } catch (err: any) {
      results.push({ channel, status: "failed", error: err.message });
    }
  }

  return results;
}

export async function contactAvailableOfficers(
  tenantId: number,
  siteName: string,
  shiftDate: string,
  shiftTime: string,
  baseUrl: string,
  maxContacts: number = 5
): Promise<{ contacted: ContactResult[]; officers: string[] }> {
  const { rows: available } = await pool.query(
    `SELECT e.id, COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as name, u.phone, u.email
     FROM employees e
     JOIN users u ON e.user_id = u.id
     WHERE e.tenant_id = $1
     AND u.is_active = true
     AND u.phone IS NOT NULL
     AND e.id NOT IN (
       SELECT s.employee_id FROM shifts s
       WHERE s.tenant_id = $1
       AND s.date = $2
       AND s.status IN ('scheduled', 'in_progress')
       AND s.employee_id IS NOT NULL
     )
     LIMIT $3`,
    [tenantId, shiftDate, maxContacts]
  );

  const results: ContactResult[] = [];
  const officerNames: string[] = [];

  for (const officer of available) {
    officerNames.push(officer.name);

    const target: ContactTarget = {
      employeeId: officer.id,
      employeeName: officer.name,
      employeePhone: officer.phone,
      employeeEmail: officer.email,
      siteName,
      shiftDate,
      shiftTime,
      tenantId,
    };

    const smsResult = await sendSMSToEmployee(
      target,
      `GARDEO: Hi ${officer.name.split(" ")[0]}, we have an urgent shift at ${siteName} starting ${shiftTime} that needs covering. Reply YES if you can cover or NO if unavailable.`,
      "shift_cover"
    );
    results.push(smsResult);
  }

  return { contacted: results, officers: officerNames };
}

export async function getContactLogs(tenantId: number, filters?: {
  employeeId?: number;
  shiftId?: number;
  channel?: string;
  triggerType?: string;
  limit?: number;
}): Promise<any[]> {
  let query = "SELECT * FROM contact_logs WHERE tenant_id = $1";
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (filters?.employeeId) {
    query += ` AND employee_id = $${paramIdx++}`;
    params.push(filters.employeeId);
  }
  if (filters?.shiftId) {
    query += ` AND shift_id = $${paramIdx++}`;
    params.push(filters.shiftId);
  }
  if (filters?.channel) {
    query += ` AND channel = $${paramIdx++}`;
    params.push(filters.channel);
  }
  if (filters?.triggerType) {
    query += ` AND trigger_type = $${paramIdx++}`;
    params.push(filters.triggerType);
  }

  query += " ORDER BY created_at DESC";
  query += ` LIMIT $${paramIdx}`;
  params.push(filters?.limit || 50);

  const { rows } = await pool.query(query, params);
  return rows;
}

export function getServiceStatus(): {
  twilio: { configured: boolean; sms: boolean; voice: boolean };
  elevenLabs: { configured: boolean; aiVoice: boolean };
  inApp: { configured: boolean };
} {
  return {
    twilio: {
      configured: isTwilioConfigured(),
      sms: isTwilioConfigured(),
      voice: isTwilioConfigured(),
    },
    elevenLabs: {
      configured: isElevenLabsConfigured(),
      aiVoice: isElevenLabsConfigured(),
    },
    inApp: { configured: true },
  };
}
