/** Safe site fields for MCP ops.read responses. */
export function sanitizeSite(row: Record<string, unknown>) {
  return {
    id: row.id,
    siteCode: row.siteCode ?? row.site_code ?? null,
    name: row.name ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    county: row.county ?? null,
    postcode: row.postcode ?? null,
    clientName: row.clientName ?? row.client_name ?? null,
    isActive: row.isActive ?? row.is_active ?? null,
    externalId: row.externalId ?? row.external_id ?? null,
  };
}

/** Safe shift fields — no payroll rates, controller notes, or exact GPS. */
export function sanitizeShift(row: Record<string, unknown>) {
  return {
    id: row.id,
    siteId: row.siteId ?? row.site_id ?? null,
    employeeId: row.employeeId ?? row.employee_id ?? null,
    supplierId: row.supplierId ?? row.supplier_id ?? null,
    shiftCode: row.shiftCode ?? row.shift_code ?? null,
    title: row.title ?? null,
    date: row.date ?? null,
    startTime: row.startTime ?? row.start_time ?? null,
    endTime: row.endTime ?? row.end_time ?? null,
    breakMinutes: row.breakMinutes ?? row.break_minutes ?? null,
    status: row.status ?? null,
    bookedOnAt: row.bookedOnAt ?? row.booked_on_at ?? null,
    bookedOffAt: row.bookedOffAt ?? row.booked_off_at ?? null,
    lateMinutes: row.lateMinutes ?? row.late_minutes ?? null,
    externalId: row.externalId ?? row.external_id ?? null,
  };
}

/** Employee search — no NI, bank, DOB, address, immigration, or licence numbers. */
export function sanitizeEmployeeSearch(row: Record<string, unknown>) {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber ?? row.employee_number ?? null,
    firstName: row.firstName ?? row.first_name ?? null,
    lastName: row.lastName ?? row.last_name ?? null,
    jobTitle: row.jobTitle ?? row.job_title ?? null,
    department: row.department ?? null,
    supplierId: row.supplierId ?? row.supplier_id ?? null,
    isActive: row.isActive ?? row.is_active ?? null,
    siaExpiryDate: row.siaExpiryDate ?? row.sia_expiry_date ?? null,
  };
}

/** Supplier list — no bank, VAT numbers, or finance contacts. */
export function sanitizeSupplier(row: Record<string, unknown>) {
  return {
    id: row.id,
    supplierCode: row.supplierCode ?? row.supplier_code ?? null,
    companyName: row.companyName ?? row.company_name ?? null,
    contactName: row.contactName ?? row.contact_name ?? null,
    city: row.city ?? null,
    postcode: row.postcode ?? null,
    supplierType: row.supplierType ?? row.supplier_type ?? null,
    status: row.status ?? null,
  };
}

/** Open incident — no free-text PII dumps beyond title/status. */
export function sanitizeIncident(row: Record<string, unknown>) {
  return {
    id: row.id,
    incidentRef: row.incidentRef ?? row.incident_ref ?? null,
    title: row.title ?? null,
    severity: row.severity ?? null,
    status: row.status ?? null,
    siteId: row.siteId ?? row.site_id ?? null,
    incidentDate: row.incidentDate ?? row.incident_date ?? null,
  };
}

/** Absence / leave snapshot — type and dates only (no fit notes / reason text). */
export function sanitizeAbsence(row: Record<string, unknown>) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? row.employee_id ?? null,
    employeeNumber: row.employeeNumber ?? row.employee_number ?? null,
    firstName: row.firstName ?? row.first_name ?? null,
    lastName: row.lastName ?? row.last_name ?? null,
    kind: row.kind ?? null,
    type: row.type ?? row.absenceType ?? row.absence_type ?? row.leaveType ?? row.leave_type ?? null,
    startDate: row.startDate ?? row.start_date ?? null,
    endDate: row.endDate ?? row.end_date ?? null,
    status: row.status ?? null,
  };
}

export function fingerprintArgs(args: unknown): string {
  const raw = JSON.stringify(args ?? {});
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `h${(hash >>> 0).toString(16)}:${raw.length}`;
}
