/**
 * One-off script to send a test email via Resend.
 * Run: npx tsx script/send-test-email.ts
 */
import "dotenv/config";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const to = process.argv[2] || "saomair@live.com";

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env");
  process.exit(1);
}

const resend = new Resend(apiKey);

async function main() {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Guardosmart <onboarding@resend.dev>",
    to: [to],
    subject: "Guardosmart – test email",
    html: "<p>This is a test email from your Guardosmart Resend integration. If you received this, email is working.</p>",
  });

  if (error) {
    console.error("Send failed:", error);
    process.exit(1);
  }
  console.log("Email sent successfully to", to, "– id:", data?.id);
}

main();
