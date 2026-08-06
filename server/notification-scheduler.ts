import { pool } from "./db";

async function runEmployeeNotificationCheck() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { rows: employees } = await pool.query(`
      SELECT e.id as employee_id, e.user_id
      FROM employees e
      WHERE e.user_id IS NOT NULL
    `);

    for (const emp of employees) {
      const userId = emp.user_id;
      const employeeId = emp.employee_id;

      const { rows: shifts } = await pool.query(`
        SELECT id, title, date, start_time, end_time, site_id
        FROM shifts
        WHERE employee_id = $1
          AND status = 'scheduled'
          AND date >= $2
          AND date <= $3
      `, [employeeId, now.toISOString().split("T")[0], in24h.toISOString().split("T")[0]]);

      for (const shift of shifts) {
        const shiftDate = new Date(shift.date);
        const [h, m] = (shift.start_time || "00:00").split(":").map(Number);
        shiftDate.setHours(h, m, 0, 0);
        if (shiftDate <= now || shiftDate > in24h) continue;

        const { rows: existing } = await pool.query(
          `SELECT id FROM notifications WHERE user_id = $1 AND type = 'shift_reminder' AND metadata->>'shiftId' = $2 AND created_at > NOW() - INTERVAL '23 hours'`,
          [userId, String(shift.id)]
        );
        if (existing.length > 0) continue;

        let siteName = "";
        if (shift.site_id) {
          const { rows: siteRows } = await pool.query("SELECT name FROM sites WHERE id = $1", [shift.site_id]);
          siteName = siteRows[0]?.name || "";
        }

        const hoursUntil = Math.round((shiftDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        const body = `Your shift "${shift.title || "Shift"}" starts in ${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""} at ${shift.start_time}${siteName ? ` at ${siteName}` : ""}.`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, link, related_entity_type, related_entity_id, metadata, created_at)
           VALUES ($1, 'shift_reminder', 'Shift Starting Soon', $2, '/my-shifts', 'shift', $3, $4, NOW())`,
          [userId, body, String(shift.id), JSON.stringify({ shiftId: shift.id, shiftDate: shift.date, startTime: shift.start_time })]
        );
      }

      const { rows: docs } = await pool.query(`
        SELECT id, document_type, expiry_date
        FROM documents
        WHERE employee_id = $1
          AND expiry_date IS NOT NULL
          AND expiry_date > NOW()
          AND expiry_date <= $2
      `, [employeeId, in30Days.toISOString()]);

      for (const doc of docs) {
        const { rows: existing } = await pool.query(
          `SELECT id FROM notifications WHERE user_id = $1 AND type = 'document_expiry' AND metadata->>'documentId' = $2 AND created_at > NOW() - INTERVAL '6 days'`,
          [userId, String(doc.id)]
        );
        if (existing.length > 0) continue;

        const expiry = new Date(doc.expiry_date);
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const docTypeLabel = (doc.document_type || "document").replace(/_/g, " ");
        const body = `Your ${docTypeLabel} expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Please upload a replacement to stay compliant.`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, link, related_entity_type, related_entity_id, metadata, created_at)
           VALUES ($1, 'document_expiry', 'Document Expiring Soon', $2, '/my-documents', 'document', $3, $4, NOW())`,
          [userId, body, String(doc.id), JSON.stringify({ documentId: doc.id, documentType: doc.document_type, expiryDate: doc.expiry_date, daysLeft })]
        );
      }
    }
  } catch (err) {
    console.error("[notification-scheduler] Error during notification check:", err);
  }
}

export function startNotificationScheduler() {
  console.log("[notification-scheduler] Starting employee notification scheduler (hourly)");

  runEmployeeNotificationCheck();

  const INTERVAL_MS = 60 * 60 * 1000;
  setInterval(() => {
    runEmployeeNotificationCheck();
  }, INTERVAL_MS);
}
