/**
 * Elastic Email v4 transactional send.
 * Not retried: a timeout after the request reached Elastic Email could otherwise send the email twice.
 */

const ELASTIC_EMAIL_API_URL = (process.env.ELASTIC_EMAIL_API_URL || "https://api.elasticemail.com/v4").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15_000;

export type ElasticEmailMessage = {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export type ElasticEmailResult = { ok: true; messageId: string | null } | { ok: false; error: string };

function errorFromBody(status: number, body: unknown): string {
  if (body && typeof body === "object" && "Error" in body && typeof (body as { Error: unknown }).Error === "string") {
    return (body as { Error: string }).Error;
  }
  if (status === 401 || status === 403) return "Elastic Email rejected the API key";
  if (status === 429) return "Elastic Email rate limit reached, try again shortly";
  return `Elastic Email request failed (${status})`;
}

export async function sendViaElasticEmail(msg: ElasticEmailMessage): Promise<ElasticEmailResult> {
  const payload = {
    Recipients: { To: [msg.to] },
    Content: {
      From: msg.from,
      ...(msg.replyTo ? { ReplyTo: msg.replyTo } : {}),
      Subject: msg.subject,
      Body: [{ ContentType: "HTML", Charset: "utf-8", Content: msg.html }],
      ...(msg.attachments?.length
        ? {
            Attachments: msg.attachments.map((a) => ({
              Name: a.filename,
              ContentType: a.contentType || "application/pdf",
              BinaryContent: a.content.toString("base64"),
            })),
          }
        : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ELASTIC_EMAIL_API_URL}/emails/transactional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ElasticEmail-ApiKey": msg.apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Elastic Email unreachable: ${message}` };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) return { ok: false, error: errorFromBody(res.status, body) };
  const messageId = body && typeof body === "object" && "MessageID" in body ? String((body as { MessageID: unknown }).MessageID) : null;
  return { ok: true, messageId };
}
