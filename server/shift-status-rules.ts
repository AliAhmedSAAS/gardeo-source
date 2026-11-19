/**
 * Status changes allowed through the generic shift edit endpoint. Book-on, book-off, verify and
 * mark-missed have dedicated endpoints that stamp timestamps and run their own checks (FSD 4.8.1).
 */

/** Fields only the lifecycle, finance, payroll and supplier-approval endpoints may set. */
export const SHIFT_SERVER_MANAGED_FIELDS = [
  "bookedOnAt", "bookedOnBy", "bookedOffAt", "bookedOffBy",
  "verifiedAt", "verifiedBy", "checkInTime", "checkOutTime", "lateMinutes",
  "financeStatus", "financeApprovedBy", "financeApprovedAt", "financeNote",
  "payrollStatus", "payrollApprovedAt", "payrollApprovedBy", "payrollRejectedReason", "payrollPaidAt", "payrollRunId",
  "supplierApprovalStatus", "supplierApprovalComment", "supplierApprovedAt", "supplierApprovedBy",
  "skipDeploymentGate",
];

const EDIT_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["scheduled", "no_show", "cancelled", "missed"],
  no_show: ["scheduled"],
  cancelled: ["scheduled", "no_show"],
  completed: ["booked_on", "in_progress"],
};

const LIFECYCLE_ENDPOINT_HINT: Record<string, string> = {
  booked_on: "Use Book On",
  in_progress: "Use Book On",
  booked_off: "Use Book Off",
  verified: "Use Verify",
  missed: "Use Mark Missed",
};

const DELETABLE_STATUSES = ["scheduled", "cancelled", "no_show", "missed"];

/** Returns why a shift must be kept (worked time, finance or payroll history), or null if it may be deleted. */
export function getShiftDeleteBlockReason(shift: {
  status: string | null;
  financeStatus?: string | null;
  payrollStatus?: string | null;
  payrollRunId?: number | null;
}): string | null {
  const status = shift.status ?? "scheduled";
  if (!DELETABLE_STATUSES.includes(status)) return `shift is "${status}" and holds worked time`;
  if (shift.financeStatus === "approved") return "shift is finance-approved";
  if (shift.payrollStatus === "approved" || shift.payrollStatus === "paid" || shift.payrollRunId != null) {
    return "shift is in payroll";
  }
  return null;
}

/** Returns an error message if the edit endpoint may not move a shift from `from` to `to`, else null. */
export function getEditStatusError(from: string, to: string, opts: { reassigning: boolean }): string | null {
  if (from === to) return null;
  if (to === "scheduled" && opts.reassigning && (from === "booked_on" || from === "in_progress")) return null;
  const allowedFrom = EDIT_TRANSITIONS[to];
  if (!allowedFrom) {
    const hint = LIFECYCLE_ENDPOINT_HINT[to];
    return `Status cannot be set to "${to}" by editing the shift.${hint ? ` ${hint} instead.` : ""}`;
  }
  if (!allowedFrom.includes(from)) {
    return `A shift that is "${from}" cannot be changed to "${to}".`;
  }
  return null;
}
