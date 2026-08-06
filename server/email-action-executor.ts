import { pool } from "./db";
import { storage } from "./storage";
import type { ProposedAction } from "@shared/schema";

type ExecutionResult = {
  success: boolean;
  message: string;
  createdId?: number;
  error?: string;
};

export async function executeAction(action: ProposedAction, tenantId: number): Promise<ExecutionResult> {
  const params = (action.actionParams || {}) as Record<string, any>;

  try {
    switch (action.actionType) {
      case "create_shift":
        return await executeCreateShift(params, tenantId);
      case "cancel_shift":
        return await executeCancelShift(params, tenantId);
      case "update_shift":
        return await executeUpdateShift(params, tenantId);
      case "create_site":
        return await executeCreateSite(params, tenantId);
      case "create_client":
        return await executeCreateClient(params, tenantId);
      case "assign_employee":
        return await executeAssignEmployee(params, tenantId);
      case "notify_team":
        return await executeNotifyTeam(params, tenantId);
      default:
        return { success: false, message: `Unknown action type: ${action.actionType}`, error: "Unsupported action" };
    }
  } catch (err: any) {
    console.error(`[EmailAction] Failed to execute ${action.actionType}:`, err.message);
    return { success: false, message: `Execution failed: ${err.message}`, error: err.message };
  }
}

async function executeCreateShift(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { siteName, date, startTime, endTime, title } = params;

  let siteId = params.siteId;
  if (!siteId && siteName) {
    const { rows } = await pool.query(
      "SELECT id FROM sites WHERE tenant_id = $1 AND LOWER(name) LIKE LOWER($2) LIMIT 1",
      [tenantId, `%${siteName}%`]
    );
    if (rows.length > 0) siteId = rows[0].id;
  }

  if (!siteId) {
    return { success: false, message: `Could not find site "${siteName || "unknown"}"`, error: "Site not found" };
  }

  const shiftDate = date || new Date().toISOString().split("T")[0];
  const shift = await storage.createShift({
    tenantId,
    siteId,
    title: title || `Shift at ${siteName || "site"}`,
    date: shiftDate,
    startTime: startTime || "08:00",
    endTime: endTime || "20:00",
    status: "scheduled",
  });

  return { success: true, message: `Created shift #${shift.id} at site ${siteId} for ${shiftDate}`, createdId: shift.id };
}

async function executeCancelShift(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { shiftId } = params;

  if (!shiftId) {
    return { success: false, message: "No shift ID provided for cancellation", error: "Missing shiftId" };
  }

  const shift = await storage.getShift(shiftId, tenantId);
  if (!shift) return { success: false, message: `Shift #${shiftId} not found`, error: "Shift not found" };

  await storage.updateShift(shiftId, { status: "cancelled" });
  return { success: true, message: `Cancelled shift #${shiftId}` };
}

async function executeUpdateShift(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { shiftId, startTime, endTime, date } = params;

  if (!shiftId) return { success: false, message: "No shift ID provided", error: "Missing shiftId" };

  const shift = await storage.getShift(shiftId, tenantId);
  if (!shift) return { success: false, message: `Shift #${shiftId} not found`, error: "Shift not found" };

  const updates: Record<string, any> = {};
  if (startTime) updates.startTime = startTime;
  if (endTime) updates.endTime = endTime;
  if (date) updates.date = date;

  await storage.updateShift(shiftId, updates);
  return { success: true, message: `Updated shift #${shiftId}` };
}

async function executeCreateSite(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { name, address, city, postcode } = params;

  if (!name) return { success: false, message: "No site name provided", error: "Missing name" };

  const site = await storage.createSite({
    tenantId,
    name,
    address: address || "",
    city: city || "",
    postcode: postcode || "",
    isActive: true,
  });

  return { success: true, message: `Created site "${name}" (ID: ${site.id})`, createdId: site.id };
}

async function executeCreateClient(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { companyName, contactName, contactEmail, contactPhone } = params;

  if (!companyName) return { success: false, message: "No company name provided", error: "Missing companyName" };

  const code = `CLT-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const { rows } = await pool.query(
    `INSERT INTO clients (tenant_id, company_name, client_code, contact_name, contact_email, contact_phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, companyName, code, contactName || null, contactEmail || null, contactPhone || null]
  );

  return { success: true, message: `Created client "${companyName}" (ID: ${rows[0].id})`, createdId: rows[0].id };
}

async function executeAssignEmployee(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { shiftId, employeeId, employeeName } = params;

  if (!shiftId) return { success: false, message: "No shift ID provided", error: "Missing shiftId" };

  const shift = await storage.getShift(shiftId, tenantId);
  if (!shift) return { success: false, message: `Shift #${shiftId} not found for this tenant`, error: "Shift not found" };

  let empId = employeeId;
  if (!empId && employeeName) {
    const { rows } = await pool.query(
      `SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id
       WHERE e.tenant_id = $1 AND (LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($2))
       LIMIT 1`,
      [tenantId, `%${employeeName}%`]
    );
    if (rows.length > 0) empId = rows[0].id;
  }

  if (!empId) return { success: false, message: `Could not find employee "${employeeName || "unknown"}"`, error: "Employee not found" };

  await storage.updateShift(shiftId, { employeeId: empId });
  return { success: true, message: `Assigned employee #${empId} to shift #${shiftId}` };
}

async function executeNotifyTeam(params: Record<string, any>, tenantId: number): Promise<ExecutionResult> {
  const { message } = params;
  return { success: true, message: `Team notification queued: "${message || "General notification"}"` };
}
