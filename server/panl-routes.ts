import type { Express, Request, RequestHandler, Response } from "express";
import type { User } from "@shared/schema";
import { pool } from "./db";
import { shiftHours } from "./payroll-control";

function requireTenant(req: Request, res: Response): number | null {
  const user = req.user as User | undefined;
  if (!user?.tenantId) {
    res.status(400).json({ message: "No tenant assigned" });
    return null;
  }
  return user.tenantId;
}

const PANL_ROLES = [
  "super_admin",
  "tenant_admin",
  "admin",
  "accountant",
  "payroll_manager",
  "ceo",
  "operations_manager",
] as const;

type GroupBy = "account" | "customer" | "location" | "officer";

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTime(t: string | null | undefined): string {
  if (!t) return "00:00";
  const s = String(t);
  if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(11, 16);
  return s.slice(0, 5);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const from = `${y}-01-01`;
  const lastJuly = new Date(y, 6, 31);
  const to = `${lastJuly.getFullYear()}-${String(lastJuly.getMonth() + 1).padStart(2, "0")}-${String(lastJuly.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function branchExpr(): string {
  return `CASE
    WHEN e.supplier_id IS NOT NULL THEN 'Contractor'
    WHEN NULLIF(TRIM(COALESCE(e.payment_type, '')), '') IS NOT NULL THEN e.payment_type
    ELSE 'MAIN'
  END`;
}

function accountExpr(): string {
  return `COALESCE(
    NULLIF(TRIM(bp.account_name), ''),
    NULLIF(TRIM(bd.account_name), ''),
    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
    e.employee_number,
    'Unassigned'
  )`;
}

type PanlFilters = {
  from: string;
  to: string;
  groupBy: GroupBy;
  account?: string;
  branch?: string;
  customerId?: number;
  officerId?: number;
  locationId?: number;
  showPaid: boolean;
  showZeroRates: boolean;
};

function parseFilters(query: any): PanlFilters {
  const defaults = defaultDateRange();
  const groupRaw = String(query.groupBy || "account").toLowerCase();
  const groupBy: GroupBy =
    groupRaw === "customer" || groupRaw === "location" || groupRaw === "officer"
      ? groupRaw
      : "account";
  return {
    from: String(query.from || query.dueFrom || defaults.from).slice(0, 10),
    to: String(query.to || query.dueTo || defaults.to).slice(0, 10),
    groupBy,
    account: query.account ? String(query.account).trim() : undefined,
    branch: query.branch ? String(query.branch).trim() : undefined,
    customerId: query.customerId ? parseInt(String(query.customerId), 10) : undefined,
    officerId: query.officerId ? parseInt(String(query.officerId), 10) : undefined,
    locationId: query.locationId ? parseInt(String(query.locationId), 10) : undefined,
    showPaid: String(query.showPaid || "").toLowerCase() === "true" || query.showPaid === "1",
    showZeroRates:
      String(query.showZeroRates || "").toLowerCase() === "true" || query.showZeroRates === "1",
  };
}

async function fetchPanlRows(tenantId: number, filters: PanlFilters) {
  const params: any[] = [tenantId, filters.from, filters.to];
  let p = 4;
  const conditions: string[] = [
    "s.tenant_id = $1",
    "s.date >= $2",
    "s.date <= $3",
    "s.status IN ('verified', 'completed')",
  ];

  if (!filters.showPaid) {
    conditions.push(`COALESCE(s.payroll_status, 'pending') <> 'paid'`);
  }
  if (filters.showZeroRates) {
    conditions.push(`(COALESCE(s.pay_rate, 0) = 0 OR COALESCE(s.charge_rate, 0) = 0)`);
  }
  if (filters.account) {
    conditions.push(`${accountExpr()} = $${p}`);
    params.push(filters.account);
    p++;
  }
  if (filters.branch) {
    conditions.push(`${branchExpr()} = $${p}`);
    params.push(filters.branch);
    p++;
  }
  if (filters.customerId && Number.isFinite(filters.customerId)) {
    conditions.push(`si.client_id = $${p}`);
    params.push(filters.customerId);
    p++;
  }
  if (filters.officerId && Number.isFinite(filters.officerId)) {
    conditions.push(`s.employee_id = $${p}`);
    params.push(filters.officerId);
    p++;
  }
  if (filters.locationId && Number.isFinite(filters.locationId)) {
    conditions.push(`s.site_id = $${p}`);
    params.push(filters.locationId);
    p++;
  }

  const { rows } = await pool.query(
    `SELECT
        s.id,
        s.date,
        s.start_time,
        s.end_time,
        s.break_minutes,
        s.pay_rate,
        s.charge_rate,
        s.expense,
        s.holiday_hours,
        s.deduction_hours,
        s.hours_override,
        s.payroll_status,
        s.duty_type_id,
        s.employee_id,
        s.site_id,
        si.name AS location_name,
        si.client_id,
        si.manager_name,
        COALESCE(c.company_name, si.client_name, '') AS customer_name,
        COALESCE(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), e.employee_number, '') AS officer_name,
        ${accountExpr()} AS account_name,
        ${branchExpr()} AS branch_name,
        dt.name AS duty_type_name
     FROM shifts s
     LEFT JOIN sites si ON si.id = s.site_id
     LEFT JOIN clients c ON c.id = si.client_id
     LEFT JOIN employees e ON e.id = s.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN bank_details bp ON bp.employee_id = e.id AND bp.account_purpose = 'payee'
     LEFT JOIN bank_details bd ON bd.employee_id = e.id AND bd.account_purpose = 'default'
     LEFT JOIN tenant_duty_types dt ON dt.id = s.duty_type_id AND dt.tenant_id = s.tenant_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.date ASC, s.start_time ASC, s.id ASC`,
    params,
  );

  return rows.map((r: any) => {
    const calcHours = shiftHours(r.start_time, r.end_time, r.break_minutes);
    const hours = r.hours_override != null && r.hours_override !== "" ? num(r.hours_override) : calcHours;
    const holidayHours = num(r.holiday_hours);
    const deductionHours = num(r.deduction_hours);
    const payRate = num(r.pay_rate);
    const sellRate = num(r.charge_rate);
    const expense = num(r.expense);
    const gWages = money(hours * payRate);
    const nWages = money(gWages + expense);
    const selling = money(hours * sellRate);
    const pnl = money(selling - gWages - expense);
    const start = normalizeTime(r.start_time);
    const end = normalizeTime(r.end_time);
    return {
      id: Number(r.id),
      date: String(r.date).slice(0, 10),
      startTime: start,
      endTime: end,
      dutyWindow: `${String(r.date).slice(0, 10)} ${start} – ${end}`,
      customerId: r.client_id != null ? Number(r.client_id) : null,
      customerName: r.customer_name || "",
      officerId: r.employee_id != null ? Number(r.employee_id) : null,
      officerName: r.officer_name || "",
      locationId: r.site_id != null ? Number(r.site_id) : null,
      locationName: r.location_name || "",
      managerName: r.manager_name || "",
      branchName: r.branch_name || "MAIN",
      accountName: r.account_name || "Unassigned",
      dutyTypeId: r.duty_type_id != null ? Number(r.duty_type_id) : null,
      dutyTypeName: r.duty_type_name || "",
      hours,
      calcHours,
      holidayHours,
      deductionHours,
      payRate,
      gWages,
      expense,
      nWages,
      sellRate,
      selling,
      pnl,
      isLoss: pnl < 0,
      payrollStatus: r.payroll_status || "pending",
      isPaid: (r.payroll_status || "") === "paid",
    };
  });
}

function groupKey(row: Awaited<ReturnType<typeof fetchPanlRows>>[number], groupBy: GroupBy): string {
  switch (groupBy) {
    case "customer":
      return row.customerName || "No customer";
    case "location":
      return row.locationName || "No location";
    case "officer":
      return row.officerName || "No officer";
    default:
      return row.accountName || "Unassigned";
  }
}

function buildGroupedRows(
  rows: Awaited<ReturnType<typeof fetchPanlRows>>,
  groupBy: GroupBy,
) {
  const sorted = [...rows].sort((a, b) => {
    const ka = groupKey(a, groupBy).localeCompare(groupKey(b, groupBy));
    if (ka !== 0) return ka;
    return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id - b.id;
  });

  type GridRow =
    | { kind: "shift"; rowNo: number; shift: (typeof sorted)[number] }
    | {
        kind: "subtotal";
        label: string;
        locationId: number | null;
        customerId: number | null;
        hours: number;
        gWages: number;
        expense: number;
        nWages: number;
        selling: number;
        pnl: number;
      };

  const out: GridRow[] = [];
  let rowNo = 0;
  let currentKey = "";
  let bucket: typeof sorted = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const key = groupKey(bucket[0], groupBy);
    const hours = money(bucket.reduce((s, r) => s + r.hours, 0));
    const gWages = money(bucket.reduce((s, r) => s + r.gWages, 0));
    const expense = money(bucket.reduce((s, r) => s + r.expense, 0));
    const nWages = money(bucket.reduce((s, r) => s + r.nWages, 0));
    const selling = money(bucket.reduce((s, r) => s + r.selling, 0));
    const pnl = money(bucket.reduce((s, r) => s + r.pnl, 0));
    out.push({
      kind: "subtotal",
      label: key,
      locationId: groupBy === "location" ? bucket[0].locationId : null,
      customerId: groupBy === "location" ? bucket[0].customerId : null,
      hours,
      gWages,
      expense,
      nWages,
      selling,
      pnl,
    });
    bucket = [];
  };

  for (const shift of sorted) {
    const key = groupKey(shift, groupBy);
    if (currentKey && key !== currentKey) flush();
    currentKey = key;
    rowNo += 1;
    out.push({ kind: "shift", rowNo, shift });
    bucket.push(shift);
  }
  flush();

  const totals = {
    hours: money(sorted.reduce((s, r) => s + r.hours, 0)),
    gWages: money(sorted.reduce((s, r) => s + r.gWages, 0)),
    expense: money(sorted.reduce((s, r) => s + r.expense, 0)),
    nWages: money(sorted.reduce((s, r) => s + r.nWages, 0)),
    selling: money(sorted.reduce((s, r) => s + r.selling, 0)),
    pnl: money(sorted.reduce((s, r) => s + r.pnl, 0)),
    count: sorted.length,
  };

  return { rows: out, totals, shifts: sorted };
}

export function registerPanlRoutes(
  app: Express,
  requireRole: (...roles: string[]) => RequestHandler,
) {
  const guard = requireRole(...PANL_ROLES);

  app.get("/api/panl/defaults", guard, async (_req, res) => {
    res.json(defaultDateRange());
  });

  app.get("/api/panl/filter-options", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const defaults = defaultDateRange();
      const from = String(req.query.from || defaults.from).slice(0, 10);
      const to = String(req.query.to || defaults.to).slice(0, 10);

      const [accounts, branches, customers, officers, locations, dutyTypes] = await Promise.all([
        pool.query(
          `SELECT DISTINCT ${accountExpr()} AS name
           FROM shifts s
           LEFT JOIN employees e ON e.id = s.employee_id
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN bank_details bp ON bp.employee_id = e.id AND bp.account_purpose = 'payee'
           LEFT JOIN bank_details bd ON bd.employee_id = e.id AND bd.account_purpose = 'default'
           WHERE s.tenant_id = $1 AND s.status IN ('verified', 'completed')
             AND s.date >= $2 AND s.date <= $3
           ORDER BY 1`,
          [tenantId, from, to],
        ),
        pool.query(
          `SELECT DISTINCT ${branchExpr()} AS name
           FROM shifts s
           LEFT JOIN employees e ON e.id = s.employee_id
           WHERE s.tenant_id = $1 AND s.status IN ('verified', 'completed')
             AND s.date >= $2 AND s.date <= $3
           ORDER BY 1`,
          [tenantId, from, to],
        ),
        pool.query(
          `SELECT DISTINCT c.id, COALESCE(c.company_name, si.client_name, 'Customer') AS name
           FROM shifts s
           JOIN sites si ON si.id = s.site_id
           LEFT JOIN clients c ON c.id = si.client_id
           WHERE s.tenant_id = $1 AND s.status IN ('verified', 'completed')
             AND s.date >= $2 AND s.date <= $3 AND si.client_id IS NOT NULL
           ORDER BY 2`,
          [tenantId, from, to],
        ),
        pool.query(
          `SELECT DISTINCT e.id,
                  COALESCE(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), e.employee_number, CAST(e.id AS text)) AS name
           FROM shifts s
           JOIN employees e ON e.id = s.employee_id
           LEFT JOIN users u ON u.id = e.user_id
           WHERE s.tenant_id = $1 AND s.status IN ('verified', 'completed')
             AND s.date >= $2 AND s.date <= $3
           ORDER BY 2`,
          [tenantId, from, to],
        ),
        pool.query(
          `SELECT DISTINCT si.id, si.name, si.client_id AS "customerId"
           FROM shifts s
           JOIN sites si ON si.id = s.site_id
           WHERE s.tenant_id = $1 AND s.status IN ('verified', 'completed')
             AND s.date >= $2 AND s.date <= $3
           ORDER BY si.name`,
          [tenantId, from, to],
        ),
        pool.query(
          `SELECT id, name FROM tenant_duty_types
           WHERE tenant_id = $1
           ORDER BY sort_order ASC, name ASC`,
          [tenantId],
        ),
      ]);

      res.json({
        accounts: accounts.rows.map((r) => r.name).filter(Boolean),
        branches: branches.rows.map((r) => r.name).filter(Boolean),
        customers: customers.rows.map((r) => ({ id: Number(r.id), name: r.name })),
        officers: officers.rows.map((r) => ({ id: Number(r.id), name: r.name })),
        locations: locations.rows.map((r) => ({
          id: Number(r.id),
          name: r.name,
          customerId: r.customerId != null ? Number(r.customerId) : null,
        })),
        dutyTypes: dutyTypes.rows.map((r) => ({ id: Number(r.id), name: r.name })),
        defaults: { from, to },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/panl", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const filters = parseFilters(req.query);
      const shifts = await fetchPanlRows(tenantId, filters);
      const grouped = buildGroupedRows(shifts, filters.groupBy);
      res.json({
        filters,
        rows: grouped.rows,
        totals: grouped.totals,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/panl/bulk-edit", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const ids: number[] = Array.isArray(req.body?.shiftIds)
        ? req.body.shiftIds.map((x: any) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n))
        : [];
      if (ids.length === 0) {
        return res.status(400).json({ message: "Select at least one shift" });
      }

      const field = String(req.body?.field || "").toLowerCase();
      const rawValue = req.body?.value;
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
        return res.status(400).json({ message: "Value is required" });
      }
      const value = num(rawValue);

      const colMap: Record<string, string> = {
        hours: "hours_override",
        payrate: "pay_rate",
        "pay_rate": "pay_rate",
        "pay rate": "pay_rate",
        expense: "expense",
        sellrate: "charge_rate",
        "sell_rate": "charge_rate",
        "sell rate": "charge_rate",
        chargerate: "charge_rate",
        "charge_rate": "charge_rate",
        "charge rate": "charge_rate",
      };
      const column = colMap[field];
      if (!column) {
        return res.status(400).json({ message: "Unsupported field — use hours, payRate, expense, or sellRate" });
      }

      const { rowCount } = await pool.query(
        `UPDATE shifts
         SET ${column} = $1, updated_at = NOW()
         WHERE tenant_id = $2
           AND id = ANY($3::int[])
           AND status IN ('verified', 'completed')`,
        [value, tenantId, ids],
      );

      res.json({ success: true, updated: rowCount || 0, field: column, value });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/panl/charge-rates", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const customerId = parseInt(String(req.query.customerId || ""), 10);
      const dutyTypeId = parseInt(String(req.query.dutyTypeId || ""), 10);
      const locationIds = String(req.query.locationIds || "")
        .split(",")
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => Number.isFinite(n));

      if (!Number.isFinite(dutyTypeId)) {
        return res.status(400).json({ message: "dutyTypeId is required" });
      }

      const rates: Array<{ rate: number; source: string; label: string }> = [];
      const seen = new Set<string>();

      if (locationIds.length > 0) {
        const { rows } = await pool.query(
          `SELECT DISTINCT r.hourly_charge_rate AS rate, si.name AS site_name
           FROM site_charge_rates r
           JOIN sites si ON si.id = r.site_id
           WHERE r.tenant_id = $1 AND r.duty_type_id = $2 AND r.site_id = ANY($3::int[])
             AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
           ORDER BY r.hourly_charge_rate`,
          [tenantId, dutyTypeId, locationIds],
        );
        for (const r of rows) {
          const rate = num(r.rate);
          const key = rate.toFixed(2);
          if (seen.has(key)) continue;
          seen.add(key);
          rates.push({ rate, source: "site", label: `£${key} — ${r.site_name}` });
        }
      }

      if (Number.isFinite(customerId)) {
        const { rows } = await pool.query(
          `SELECT DISTINCT hourly_charge_rate AS rate, role_type
           FROM client_rate_cards
           WHERE tenant_id = $1 AND client_id = $2
             AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
           ORDER BY hourly_charge_rate`,
          [tenantId, customerId],
        );
        for (const r of rows) {
          const rate = num(r.rate);
          const key = rate.toFixed(2);
          if (seen.has(key)) continue;
          seen.add(key);
          rates.push({ rate, source: "client", label: `£${key} — client ${r.role_type || "rate"}` });
        }
      }

      res.json({ rates });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/panl/charge-rate", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const locations: Array<{ locationId: number; customerId?: number | null }> = Array.isArray(
        req.body?.locations,
      )
        ? req.body.locations
            .map((l: any) => ({
              locationId: parseInt(String(l.locationId ?? l.id), 10),
              customerId: l.customerId != null ? parseInt(String(l.customerId), 10) : null,
            }))
            .filter((l: any) => Number.isFinite(l.locationId))
        : [];
      const dutyTypeId = parseInt(String(req.body?.dutyTypeId), 10);
      const rate = num(req.body?.rate);
      const dateFrom = String(req.body?.dateFrom || "").slice(0, 10);
      const dateTo = String(req.body?.dateTo || "").slice(0, 10);
      const applyToShifts = !!req.body?.applyToShifts;

      if (locations.length === 0) {
        return res.status(400).json({ message: "Tick at least one location" });
      }
      if (!Number.isFinite(dutyTypeId) || rate <= 0) {
        return res.status(400).json({ message: "Duty type and rate are required" });
      }

      const siteIds = locations.map((l) => l.locationId);
      const effectiveFrom = dateFrom || new Date().toISOString().slice(0, 10);

      for (const siteId of siteIds) {
        const existing = await pool.query(
          `SELECT id FROM site_charge_rates
           WHERE tenant_id = $1 AND site_id = $2 AND duty_type_id = $3 AND effective_from = $4`,
          [tenantId, siteId, dutyTypeId, effectiveFrom],
        );
        if (existing.rows[0]) {
          await pool.query(
            `UPDATE site_charge_rates
             SET hourly_charge_rate = $1, effective_to = $2, notes = COALESCE(notes, 'PANL charge rate')
             WHERE id = $3`,
            [rate, dateTo || null, existing.rows[0].id],
          );
        } else {
          await pool.query(
            `INSERT INTO site_charge_rates
               (tenant_id, site_id, duty_type_id, hourly_charge_rate, effective_from, effective_to, notes)
             VALUES ($1, $2, $3, $4, $5, $6, 'PANL charge rate')`,
            [tenantId, siteId, dutyTypeId, rate, effectiveFrom, dateTo || null],
          );
        }
      }

      let shiftsUpdated = 0;
      if (applyToShifts) {
        if (!dateFrom || !dateTo) {
          return res.status(400).json({ message: "dateFrom and dateTo are required when applying to shifts" });
        }
        const result = await pool.query(
          `UPDATE shifts
           SET charge_rate = $1, duty_type_id = $2, updated_at = NOW()
           WHERE tenant_id = $3
             AND site_id = ANY($4::int[])
             AND date >= $5 AND date <= $6
             AND status IN ('verified', 'completed')`,
          [rate, dutyTypeId, tenantId, siteIds, dateFrom, dateTo],
        );
        shiftsUpdated = result.rowCount || 0;
      }

      res.json({
        success: true,
        locationsUpdated: siteIds.length,
        shiftsUpdated,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/panl/export.csv", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const filters = parseFilters(req.query);
      const shifts = await fetchPanlRows(tenantId, filters);

      const header = [
        "Day",
        "Date",
        "Location",
        "Customer",
        "Manager",
        "Branch",
        "Officer",
        "Hours",
        "Holiday hours",
        "Account",
        "Time-in",
        "Time-out",
        "Actual hrs",
        "Deduction hrs",
        "Charge rate",
        "Pay rate",
        "Wages",
        "Selling",
        "Gross profit",
        "Expense",
        "Net profit",
      ];

      const lines = [header.join(",")];
      for (const r of shifts) {
        const day = new Date(`${r.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
        const wageHours = r.hours + r.holidayHours + r.deductionHours;
        const sellHours = r.hours + r.holidayHours;
        const wages = money(wageHours * r.payRate);
        const selling = money(sellHours * r.sellRate);
        const gross = money(selling - wages);
        // Net profit = Selling − wages ± expense (negative expense subtracts; positive adds)
        const net = money(selling - wages + r.expense);
        lines.push(
          [
            day,
            r.date,
            r.locationName,
            r.customerName,
            r.managerName,
            r.branchName,
            r.officerName,
            r.hours,
            r.holidayHours,
            r.accountName,
            r.startTime,
            r.endTime,
            r.calcHours,
            r.deductionHours,
            r.sellRate,
            r.payRate,
            wages,
            selling,
            gross,
            r.expense,
            net,
          ]
            .map(csvEscape)
            .join(","),
        );
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="panl-${filters.from}-to-${filters.to}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/panl/statement", guard, async (req, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (tenantId == null) return;
      const account = req.query.account ? String(req.query.account).trim() : "";
      const status = String(req.query.status || "UNPAID").toUpperCase() === "PAID" ? "PAID" : "UNPAID";
      const from = String(req.query.from || "").slice(0, 10);
      const to = String(req.query.to || "").slice(0, 10);
      if (!from || !to) {
        return res.status(400).json({ message: "from and to are required" });
      }

      const filters: PanlFilters = {
        from,
        to,
        groupBy: "account",
        account: account && account.toLowerCase() !== "all" ? account : undefined,
        showPaid: status === "PAID",
        showZeroRates: false,
      };

      let shifts = await fetchPanlRows(tenantId, filters);
      if (status === "PAID") {
        shifts = shifts.filter((s) => s.isPaid);
      } else {
        shifts = shifts.filter((s) => !s.isPaid);
      }

      const tenant = await pool.query(`SELECT name, trading_name FROM tenants WHERE id = $1`, [tenantId]);
      const company = tenant.rows[0]?.trading_name || tenant.rows[0]?.name || "Company";

      const totals = {
        hours: money(shifts.reduce((s, r) => s + r.hours, 0)),
        gWages: money(shifts.reduce((s, r) => s + r.gWages, 0)),
        expense: money(shifts.reduce((s, r) => s + r.expense, 0)),
        selling: money(shifts.reduce((s, r) => s + r.selling, 0)),
        pnl: money(shifts.reduce((s, r) => s + r.pnl, 0)),
      };

      const rowsHtml = shifts
        .map(
          (r) => `<tr class="${r.isLoss ? "loss" : ""}">
            <td>${r.dutyWindow}</td>
            <td>${escapeHtml(r.customerName)}</td>
            <td>${escapeHtml(r.officerName)}</td>
            <td>${escapeHtml(r.locationName)}</td>
            <td class="num">${r.hours.toFixed(2)}</td>
            <td class="num">${r.payRate.toFixed(2)}</td>
            <td class="num">${r.gWages.toFixed(2)}</td>
            <td class="num">${r.expense.toFixed(2)}</td>
            <td class="num">${r.sellRate.toFixed(2)}</td>
            <td class="num">${r.selling.toFixed(2)}</td>
            <td class="num">${r.pnl.toFixed(2)}</td>
          </tr>`,
        )
        .join("\n");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>P&L Statement</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  .meta{color:#555;margin-bottom:16px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
  th{background:#f3f3f3}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  tr.loss td{background:#ffe5e5}
  tfoot td{font-weight:bold;background:#fafafa}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Print</button>
<h1>${escapeHtml(company)} — Profit &amp; Loss Statement</h1>
<div class="meta">Account: ${escapeHtml(account || "All")} · Status: ${status} · ${from} to ${to}</div>
<table>
<thead><tr>
  <th>Duty window</th><th>Customer</th><th>Officer</th><th>Location</th>
  <th>Hours</th><th>Pay rate</th><th>G.Wages</th><th>Expense</th>
  <th>Sell rate</th><th>Selling</th><th>P&amp;L</th>
</tr></thead>
<tbody>${rowsHtml || `<tr><td colspan="11">No shifts</td></tr>`}</tbody>
<tfoot><tr>
  <td colspan="4">Totals (${shifts.length} shifts)</td>
  <td class="num">${totals.hours.toFixed(2)}</td>
  <td></td>
  <td class="num">${totals.gWages.toFixed(2)}</td>
  <td class="num">${totals.expense.toFixed(2)}</td>
  <td></td>
  <td class="num">${totals.selling.toFixed(2)}</td>
  <td class="num">${totals.pnl.toFixed(2)}</td>
</tr></tfoot>
</table>
<script>window.onload=function(){/* printable statement — does not mutate shifts */}</script>
</body></html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
