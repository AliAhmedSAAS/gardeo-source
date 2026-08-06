import twilio from "twilio";

let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.log("Twilio credentials not configured. SMS/Voice features disabled.");
    return null;
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

function getFromNumber(): string {
  return process.env.TWILIO_PHONE_NUMBER || "";
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const client = getClient();
  if (!client) {
    console.log(`[Twilio Mock] SMS to ${to}: ${body}`);
    return { success: true, sid: `mock_sms_${Date.now()}` };
  }

  const fromNumber = getFromNumber();
  if (!fromNumber) {
    return { success: false, error: "TWILIO_PHONE_NUMBER not configured" };
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
    console.log(`[Twilio] SMS sent to ${to}, SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error(`[Twilio] SMS failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function makeVoiceCall(
  to: string,
  twimlUrl: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const client = getClient();
  if (!client) {
    console.log(`[Twilio Mock] Voice call to ${to} with TwiML: ${twimlUrl}`);
    return { success: true, sid: `mock_call_${Date.now()}` };
  }

  const fromNumber = getFromNumber();
  if (!fromNumber) {
    return { success: false, error: "TWILIO_PHONE_NUMBER not configured" };
  }

  try {
    const call = await client.calls.create({
      url: twimlUrl,
      from: fromNumber,
      to,
    });
    console.log(`[Twilio] Call initiated to ${to}, SID: ${call.sid}`);
    return { success: true, sid: call.sid };
  } catch (err: any) {
    console.error(`[Twilio] Call failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

export function generateTwiML(message: string, gatherOptions?: { action: string; numDigits: number }): string {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (gatherOptions) {
    twiml += `<Gather action="${gatherOptions.action}" numDigits="${gatherOptions.numDigits}" timeout="10">`;
    twiml += `<Say voice="Polly.Amy" language="en-GB">${escapeXml(message)}</Say>`;
    twiml += '</Gather>';
    twiml += '<Say voice="Polly.Amy" language="en-GB">We did not receive any input. Goodbye.</Say>';
  } else {
    twiml += `<Say voice="Polly.Amy" language="en-GB">${escapeXml(message)}</Say>`;
  }

  twiml += '</Response>';
  return twiml;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
