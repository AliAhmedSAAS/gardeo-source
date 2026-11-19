import type { PoolClient } from "pg";
import { pool } from "./db";

export interface BlockedEmployee {
  id: number;
  reasons: string[];
}

/** Profile records owned by the employee; removed together with the employee. */
const EMPLOYEE_PROFILE_TABLES = [
  "absence_records", "bank_details", "documents", "emergency_contacts", "employee_address_history",
  "employee_availability", "employee_certificates", "employee_driving_licences", "employee_education",
  "employee_health", "employee_immigration", "employee_invitations", "employee_notes", "employee_pay_rates",
  "employee_preferred_sites", "employee_sia_licences", "employment_history", "hr_cases", "leave_entitlements",
  "ops_checks", "p_form_records", "pending_bank_changes", "probation_records", "rate_cards", '"references"',
  "right_of_work_checks", "time_off_requests", "training_records", "vetting_audit_events", "vetting_records",
  "employee_policies", "employee_audit_trail",
];

/** Shifts in these statuses carry no worked time, so they can be unassigned instead of blocking. */
const UNWORKED_SHIFT_STATUSES = ["scheduled", "cancelled", "no_show", "missed"];

/** Worked, invoiced or payroll history that must be kept; an employee with any of it is not deleted. */
async function findBlockingRecords(client: PoolClient, employeeId: number): Promise<string[]> {
  const { rows: [counts] } = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM shifts WHERE employee_id = $1
          AND (status::text <> ALL($2::text[]) OR payroll_run_id IS NOT NULL))::int AS worked_shifts,
       (SELECT COUNT(*) FROM invoices WHERE employee_id = $1)::int AS invoices,
       ((SELECT COUNT(*) FROM payroll_run_items WHERE employee_id = $1)
        + (SELECT COUNT(*) FROM payroll_applied_lines WHERE employee_id = $1)
        + (SELECT COUNT(*) FROM payroll_bills WHERE employee_id = $1)
        + (SELECT COUNT(*) FROM payroll_payslips WHERE employee_id = $1)
        + (SELECT COUNT(*) FROM payroll_control_months WHERE employee_id = $1))::int AS payroll_records`,
    [employeeId, UNWORKED_SHIFT_STATUSES],
  );
  const reasons: string[] = [];
  if (counts.worked_shifts > 0) reasons.push(`${counts.worked_shifts} worked or payroll-processed shift(s)`);
  if (counts.invoices > 0) reasons.push(`${counts.invoices} invoice(s)`);
  if (counts.payroll_records > 0) reasons.push(`${counts.payroll_records} payroll record(s)`);
  return reasons;
}

async function detachUserReferences(client: PoolClient, userId: string, tenantId: number): Promise<void> {
  const statements: [string, unknown[]][] = [
    ["DELETE FROM onboarding_records WHERE user_id = $1", [userId]],
    ["DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]],
    ["DELETE FROM notifications WHERE user_id = $1", [userId]],
    ["DELETE FROM audit_logs WHERE user_id = $1", [userId]],
    ["DELETE FROM data_consents WHERE user_id = $1", [userId]],
    ["DELETE FROM data_erasure_requests WHERE user_id = $1", [userId]],
    ["UPDATE incidents SET reported_by = NULL WHERE reported_by = $1", [userId]],
    ["UPDATE incidents SET assigned_to = NULL WHERE assigned_to = $1", [userId]],
    ["UPDATE shifts SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE shifts SET booked_on_by = NULL WHERE booked_on_by = $1", [userId]],
    ["UPDATE shifts SET booked_off_by = NULL WHERE booked_off_by = $1", [userId]],
    ["UPDATE shifts SET verified_by = NULL WHERE verified_by = $1", [userId]],
    ["UPDATE shifts SET finance_approved_by = NULL WHERE finance_approved_by = $1", [userId]],
    ["UPDATE invoices SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE invoices SET issued_by = NULL WHERE issued_by = $1", [userId]],
    ["UPDATE invoices SET paid_by = NULL WHERE paid_by = $1", [userId]],
    ["UPDATE invoices SET accepted_by_supplier_user_id = NULL WHERE accepted_by_supplier_user_id = $1", [userId]],
    ["UPDATE documents SET verified_by = NULL WHERE verified_by = $1", [userId]],
    ["UPDATE vetting_records SET conducted_by = NULL WHERE conducted_by = $1", [userId]],
    ["UPDATE employee_pay_rates SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE job_postings SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE rate_cards SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE rate_card_history SET changed_by = NULL WHERE changed_by = $1", [userId]],
    ["UPDATE credit_notes SET issued_by = NULL WHERE issued_by = $1", [userId]],
    ["UPDATE debit_notes SET issued_by = NULL WHERE issued_by = $1", [userId]],
    ["UPDATE disputes SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE disputes SET resolved_by = NULL WHERE resolved_by = $1", [userId]],
    ["DELETE FROM dispute_messages WHERE user_id = $1", [userId]],
    ["UPDATE suppliers SET user_id = NULL WHERE user_id = $1", [userId]],
    ["UPDATE suppliers SET created_by = NULL WHERE created_by = $1", [userId]],
    ["UPDATE suppliers SET approved_by = NULL WHERE approved_by = $1", [userId]],
    ["UPDATE suppliers SET submitted_by = NULL WHERE submitted_by = $1", [userId]],
    ["UPDATE suppliers SET suspended_by = NULL WHERE suspended_by = $1", [userId]],
    ["UPDATE suppliers SET last_review_by = NULL WHERE last_review_by = $1", [userId]],
    ["UPDATE suppliers SET info_required_by = NULL WHERE info_required_by = $1", [userId]],
    ["UPDATE supplier_documents SET uploaded_by = NULL WHERE uploaded_by = $1", [userId]],
    ["UPDATE supplier_documents SET reviewed_by = NULL WHERE reviewed_by = $1", [userId]],
    ["DELETE FROM supplier_document_audit WHERE user_id = $1", [userId]],
    ["DELETE FROM supplier_audit_events WHERE actor_user_id = $1", [userId]],
    ["DELETE FROM supplier_login_activity WHERE user_id = $1", [userId]],
    ["UPDATE supplier_pending_changes SET user_id = NULL WHERE user_id = $1", [userId]],
    ["UPDATE supplier_pending_changes SET reviewed_by = NULL WHERE reviewed_by = $1", [userId]],
    ["DELETE FROM supplier_profile_change_log WHERE user_id = $1", [userId]],
    ["UPDATE supplier_field_requests SET requested_by = NULL WHERE requested_by = $1", [userId]],
    ["UPDATE supplier_policies SET uploaded_by = NULL WHERE uploaded_by = $1", [userId]],
    ["UPDATE supplier_policies SET reviewed_by = NULL WHERE reviewed_by = $1", [userId]],
    ["DELETE FROM supplier_invitations WHERE created_by = $1", [userId]],
    ["DELETE FROM employee_invitations WHERE created_by = $1", [userId]],
    ["DELETE FROM tenant_invitations WHERE invited_by = $1", [userId]],
    ["UPDATE onboarding_records SET reviewed_by = NULL WHERE reviewed_by = $1", [userId]],
    ["UPDATE vat_verifications SET verified_by = NULL WHERE verified_by = $1", [userId]],
    ["DELETE FROM sessions WHERE sess::text LIKE $1", [`%${userId}%`]],
    ["DELETE FROM users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]],
  ];
  for (const [sql, params] of statements) await client.query(sql, params);
}

/**
 * Deletes employees (and their login) that have no worked, invoiced or payroll history.
 * Each employee runs in its own savepoint, so one blocked employee does not undo the others.
 */
export async function deleteEmployees(
  tenantId: number,
  employeeIds: number[],
): Promise<{ deleted: number[]; blocked: BlockedEmployee[] }> {
  const deleted: number[] = [];
  const blocked: BlockedEmployee[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const employeeId of employeeIds) {
      const { rows: [employee] } = await client.query(
        "SELECT id, user_id FROM employees WHERE id = $1 AND tenant_id = $2",
        [employeeId, tenantId],
      );
      if (!employee) continue;

      const reasons = await findBlockingRecords(client, employeeId);
      if (reasons.length > 0) {
        blocked.push({ id: employeeId, reasons });
        continue;
      }

      await client.query("SAVEPOINT employee_delete");
      try {
        await client.query("UPDATE shifts SET employee_id = NULL WHERE employee_id = $1", [employeeId]);
        for (const table of EMPLOYEE_PROFILE_TABLES) {
          await client.query(`DELETE FROM ${table} WHERE employee_id = $1`, [employeeId]);
        }
        await client.query("DELETE FROM employees WHERE id = $1 AND tenant_id = $2", [employeeId, tenantId]);
        if (employee.user_id) await detachUserReferences(client, employee.user_id, tenantId);
        await client.query("RELEASE SAVEPOINT employee_delete");
        deleted.push(employeeId);
      } catch (err: any) {
        await client.query("ROLLBACK TO SAVEPOINT employee_delete");
        if (err?.code !== "23503") throw err;
        blocked.push({ id: employeeId, reasons: [`linked records in ${err.table ?? "another table"}`] });
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return { deleted, blocked };
}
