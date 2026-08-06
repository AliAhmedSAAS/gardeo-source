import { pool } from "./db";
import { sendOnboardingReminder } from "./email";

const REMINDER_MILESTONE_DAYS = [3, 1, 0];

async function runOnboardingReminderCheck(baseUrl: string) {
  try {
    const { rows: records } = await pool.query(`
      SELECT
        o.id, o.user_id, o.tenant_id, o.status, o.deadline, o.last_reminder_sent_at,
        u.email, u.first_name, u.last_name
      FROM onboarding_records o
      JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('invited', 'in_progress')
        AND o.deadline IS NOT NULL
    `);

    const now = new Date();

    for (const record of records) {
      const deadline = new Date(record.deadline);
      const msUntil = deadline.getTime() - now.getTime();
      const daysUntil = Math.ceil(msUntil / (1000 * 60 * 60 * 24));

      const lastSent = record.last_reminder_sent_at ? new Date(record.last_reminder_sent_at) : null;

      const shouldRemind = REMINDER_MILESTONE_DAYS.some(targetDay => {
        if (daysUntil !== targetDay) return false;
        if (lastSent) {
          const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLast < 20) return false;
        }
        return true;
      });

      if (!shouldRemind) continue;

      const email = record.email;
      const name = `${record.first_name || ""} ${record.last_name || ""}`.trim() || "there";
      const onboardingLink = `${baseUrl}/onboarding`;

      const result = await sendOnboardingReminder({
        to: email,
        employeeName: name,
        daysUntilDeadline: daysUntil,
        deadline,
        onboardingLink,
      });

      if (result.ok) {
        await pool.query(
          "UPDATE onboarding_records SET last_reminder_sent_at = NOW() WHERE id = $1",
          [record.id]
        );
        console.log(`[onboarding-scheduler] Reminder sent to ${email} (onboarding #${record.id}, ${daysUntil} days until deadline)`);
      } else {
        console.warn(`[onboarding-scheduler] Failed to send reminder to ${email}:`, result.error);
      }
    }
  } catch (err) {
    console.error("[onboarding-scheduler] Error during reminder check:", err);
  }
}

export function startOnboardingScheduler(baseUrl: string) {
  console.log("[onboarding-scheduler] Starting daily onboarding reminder scheduler");

  runOnboardingReminderCheck(baseUrl);

  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runOnboardingReminderCheck(baseUrl);
  }, INTERVAL_MS);
}
