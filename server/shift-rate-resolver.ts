import { pool } from "./db";
import { storage } from "./storage";

export type RateOption = {
  id: string;
  rate: string;
  label: string;
  dutyTypeId?: number | null;
  dutyTypeName?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  roleType?: string | null;
};

function dateOnly(d: string | Date): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatOptionLabel(rate: string, parts: (string | null | undefined)[]): string {
  const extra = parts.filter(Boolean).join(" · ");
  return extra ? `£${Number(rate).toFixed(2)}/hr — ${extra}` : `£${Number(rate).toFixed(2)}/hr`;
}

/** All site charge rates applicable for site (+ optional duty) on date. */
export async function listSiteChargeRates(params: {
  tenantId: number;
  siteId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<RateOption[]> {
  if (!params.siteId) return [];
  const day = dateOnly(params.date);
  const values: any[] = [params.tenantId, params.siteId, day];
  let dutyFilter = "";
  if (params.dutyTypeId) {
    dutyFilter = "AND r.duty_type_id = $4";
    values.push(params.dutyTypeId);
  }
  const { rows } = await pool.query(
    `SELECT r.id, r.hourly_charge_rate, r.duty_type_id, r.effective_from, r.effective_to, d.name as duty_type_name
     FROM site_charge_rates r
     LEFT JOIN tenant_duty_types d ON d.id = r.duty_type_id
     WHERE r.tenant_id = $1 AND r.site_id = $2
       AND r.effective_from <= $3::date
       AND (r.effective_to IS NULL OR r.effective_to >= $3::date)
       ${dutyFilter}
     ORDER BY r.effective_from DESC, d.name NULLS LAST`,
    values,
  );
  return rows.map((r: any) => ({
    id: `site-${r.id}`,
    rate: String(r.hourly_charge_rate),
    label: formatOptionLabel(String(r.hourly_charge_rate), [
      r.duty_type_name,
      r.effective_from ? `from ${String(r.effective_from).slice(0, 10)}` : null,
      r.effective_to ? `to ${String(r.effective_to).slice(0, 10)}` : "ongoing",
    ]),
    dutyTypeId: r.duty_type_id,
    dutyTypeName: r.duty_type_name,
    effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : null,
    effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
  }));
}

/** Employee pay rates applicable on date (+ optional duty). */
export async function listEmployeePayRates(params: {
  tenantId: number;
  employeeId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<RateOption[]> {
  if (!params.employeeId) return [];
  const day = dateOnly(params.date);
  const values: any[] = [params.tenantId, params.employeeId, day];
  let dutyFilter = "";
  if (params.dutyTypeId) {
    // Prefer matching duty, but still show rates with null duty type
    dutyFilter = "AND (r.duty_type_id = $4 OR r.duty_type_id IS NULL)";
    values.push(params.dutyTypeId);
  }
  const { rows } = await pool.query(
    `SELECT r.id, r.hourly_rate, r.duty_type_id, r.effective_from, r.effective_to, r.reason, d.name as duty_type_name
     FROM employee_pay_rates r
     LEFT JOIN tenant_duty_types d ON d.id = r.duty_type_id
     WHERE r.tenant_id = $1 AND r.employee_id = $2
       AND r.effective_from <= $3::date
       AND (r.effective_to IS NULL OR r.effective_to >= $3::date)
       ${dutyFilter}
     ORDER BY
       CASE WHEN r.duty_type_id IS NOT NULL THEN 0 ELSE 1 END,
       r.effective_from DESC`,
    values,
  );

  const options: RateOption[] = rows.map((r: any) => ({
    id: `emp-${r.id}`,
    rate: String(r.hourly_rate),
    label: formatOptionLabel(String(r.hourly_rate), [
      r.duty_type_name || "General",
      r.reason,
      r.effective_from ? `from ${String(r.effective_from).slice(0, 10)}` : null,
      r.effective_to ? `to ${String(r.effective_to).slice(0, 10)}` : "ongoing",
    ]),
    dutyTypeId: r.duty_type_id,
    dutyTypeName: r.duty_type_name,
    effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : null,
    effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
  }));

  if (options.length === 0) {
    const emp = await storage.getEmployee(params.employeeId, params.tenantId);
    if (emp?.hourlyRate != null) {
      options.push({
        id: `emp-default-${params.employeeId}`,
        rate: String(emp.hourlyRate),
        label: formatOptionLabel(String(emp.hourlyRate), ["Employee default"]),
      });
    }
  }
  return options;
}

/** Supplier rate cards applicable on date. */
export async function listSupplierPayRates(params: {
  tenantId: number;
  supplierId: number | null | undefined;
  siteId: number | null | undefined;
  employeeId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<RateOption[]> {
  if (!params.supplierId) return [];
  const day = dateOnly(params.date);

  let dutyName: string | null = null;
  if (params.dutyTypeId) {
    const { rows } = await pool.query(
      `SELECT name FROM tenant_duty_types WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [params.dutyTypeId, params.tenantId],
    );
    dutyName = rows[0]?.name || null;
  }

  const { rows: cards } = await pool.query(
    `SELECT * FROM rate_cards
     WHERE tenant_id = $1 AND supplier_id = $2
       AND effective_from <= $3::date
       AND (effective_to IS NULL OR effective_to >= $3::date)
     ORDER BY effective_from DESC`,
    [params.tenantId, params.supplierId, day],
  );

  const siteId = params.siteId || null;
  const employeeId = params.employeeId || null;

  const scored = cards
    .filter((rc: any) => {
      if (rc.site_id && siteId && rc.site_id !== siteId) return false;
      if (rc.employee_id && employeeId && rc.employee_id !== employeeId) return false;
      return true;
    })
    .map((rc: any) => {
      let score = 0;
      if (rc.employee_id && rc.site_id) score = 4;
      else if (rc.employee_id) score = 3;
      else if (rc.site_id) score = 2;
      else score = 1;
      if (dutyName && rc.role_type && String(rc.role_type).toLowerCase() === dutyName.toLowerCase()) score += 2;
      else if (dutyName && rc.role_type && String(rc.role_type).toLowerCase() !== dutyName.toLowerCase()) score -= 1;
      return { rc, score };
    })
    .sort((a: any, b: any) => b.score - a.score);

  return scored
    .filter((s: any) => s.rc.hourly_rate != null)
    .map((s: any) => {
      const rc = s.rc;
      return {
        id: `sup-${rc.id}`,
        rate: String(rc.hourly_rate),
        label: formatOptionLabel(String(rc.hourly_rate), [
          rc.role_type,
          rc.site_id ? "Site-specific" : null,
          rc.employee_id ? "Officer-specific" : null,
          rc.effective_from ? `from ${String(rc.effective_from).slice(0, 10)}` : null,
          rc.effective_to ? `to ${String(rc.effective_to).slice(0, 10)}` : "ongoing",
        ]),
        roleType: rc.role_type,
        effectiveFrom: rc.effective_from ? String(rc.effective_from).slice(0, 10) : null,
        effectiveTo: rc.effective_to ? String(rc.effective_to).slice(0, 10) : null,
      } as RateOption;
    });
}

/** Best single match (first option). */
export async function lookupSiteChargeRate(params: {
  tenantId: number;
  siteId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<string | null> {
  const opts = await listSiteChargeRates(params);
  return opts[0]?.rate ?? null;
}

export async function lookupEmployeePayRate(params: {
  tenantId: number;
  employeeId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<string | null> {
  const opts = await listEmployeePayRates(params);
  return opts[0]?.rate ?? null;
}

export async function lookupSupplierPayRate(params: {
  tenantId: number;
  supplierId: number | null | undefined;
  siteId: number | null | undefined;
  employeeId: number | null | undefined;
  dutyTypeId: number | null | undefined;
  date: string;
}): Promise<string | null> {
  const opts = await listSupplierPayRates(params);
  return opts[0]?.rate ?? null;
}

/**
 * Resolve rates for a shift:
 * - charge options from site
 * - pay options from employee (in-house) or supplier rate cards
 */
export async function resolveShiftRates(params: {
  tenantId: number;
  siteId?: number | null;
  employeeId?: number | null;
  supplierId?: number | null;
  dutyTypeId?: number | null;
  date: string;
}): Promise<{
  chargeRate: string | null;
  payRate: string | null;
  payRateSource: "employee" | "supplier" | null;
  chargeRateSource: "site" | null;
  chargeRateOptions: RateOption[];
  payRateOptions: RateOption[];
}> {
  const siteId = params.siteId ?? null;
  const employeeId = params.employeeId ?? null;
  const supplierId = params.supplierId ?? null;
  const dutyTypeId = params.dutyTypeId ?? null;

  const chargeRateOptions = await listSiteChargeRates({
    tenantId: params.tenantId,
    siteId,
    dutyTypeId,
    date: params.date,
  });

  const inHouse = !supplierId;
  let payRateOptions: RateOption[] = [];
  let payRateSource: "employee" | "supplier" | null = null;

  if (inHouse) {
    payRateOptions = await listEmployeePayRates({
      tenantId: params.tenantId,
      employeeId,
      dutyTypeId,
      date: params.date,
    });
    if (payRateOptions.length) payRateSource = "employee";
  } else {
    payRateOptions = await listSupplierPayRates({
      tenantId: params.tenantId,
      supplierId,
      siteId,
      employeeId,
      dutyTypeId,
      date: params.date,
    });
    if (payRateOptions.length) payRateSource = "supplier";
  }

  return {
    chargeRate: chargeRateOptions[0]?.rate ?? null,
    payRate: payRateOptions[0]?.rate ?? null,
    payRateSource,
    chargeRateSource: chargeRateOptions.length ? "site" : null,
    chargeRateOptions,
    payRateOptions,
  };
}
