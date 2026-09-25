import { pool } from "./db";
import {
  PAYE_RATE,
  getRuleDef,
  payeBucketForSource,
  monthStart,
  monthEnd,
  type WageBucket,
} from "@shared/payrollControl";

export function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function num(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Format a pg DATE / Date / ISO string as YYYY-MM-DD (never locale "Sat Aug 01"). */
export function formatPgDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // node-pg maps DATE to local midnight. In UTC+5 that is previous-day 19:00Z,
    // so use local Y-M-D (not UTC) or Aug 1 shows as Jul 31.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !s.includes("T")) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return monthStart(s);
}

/** Normalize "07:00", "7:00:00", or "2026-08-01 07:00:00" → HH:MM */
export function normalizeTime(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "00:00";
  // "YYYY-MM-DD HH:MM[:SS]" or ISO-ish
  const space = raw.includes("T") ? raw.split("T").pop() : raw.includes(" ") ? raw.split(" ").pop() : raw;
  const m = String(space || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return "00:00";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * Paid hours for a shift (legacy parity):
 *   hours = end − start  (overnight +24h)
 *         − break_minutes / 60
 * Rounded to 2dp. Does NOT add holiday hours (shifts table has no holiday field;
 * PHP used Hours + holiday_hours from tbl_dutyschedule).
 */
export function shiftHours(startTime: string, endTime: string, breakMinutes?: number | null): number {
  const [sh, sm] = normalizeTime(startTime).split(":").map((x) => parseInt(x, 10) || 0);
  const [eh, em] = normalizeTime(endTime).split(":").map((x) => parseInt(x, 10) || 0);
  let hours = (eh + em / 60) - (sh + sm / 60);
  if (hours < 0) hours += 24; // overnight e.g. 19:00 → 07:00 = 12h
  hours -= (Number(breakMinutes) || 0) / 60;
  return money(Math.max(0, hours));
}

export async function nextBillNumber(tenantId: number): Promise<string> {
  const { rows } = await pool.query(
    `SELECT bill_number FROM payroll_bills WHERE tenant_id = $1 AND bill_number IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [tenantId],
  );
  let n = 1;
  if (rows[0]?.bill_number) {
    const m = String(rows[0].bill_number).match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `BILL-${n.toString().padStart(5, "0")}`;
}

export async function ensureMonthRow(tenantId: number, employeeId: number, month: string) {
  const period = monthStart(month);
  const existing = await pool.query(
    `SELECT * FROM payroll_control_months WHERE tenant_id = $1 AND employee_id = $2 AND period_month = $3`,
    [tenantId, employeeId, period],
  );
  if (existing.rows[0]) return existing.rows[0];
  const inserted = await pool.query(
    `INSERT INTO payroll_control_months (tenant_id, employee_id, period_month)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, employee_id, period_month) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [tenantId, employeeId, period],
  );
  return inserted.rows[0];
}

async function selfRateForShift(tenantId: number, employeeId: number, shift: any): Promise<number> {
  if (shift.pay_rate) {
    const r = num(shift.pay_rate);
    if (r > 0) return r;
  }
  const { rows } = await pool.query(
    `SELECT hourly_rate FROM employee_pay_rates
     WHERE employee_id = $1 AND tenant_id = $2
       AND effective_from <= $3::date
       AND (effective_to IS NULL OR effective_to >= $3::date)
     ORDER BY effective_from DESC LIMIT 1`,
    [employeeId, tenantId, shift.date],
  );
  if (rows[0]) return num(rows[0].hourly_rate);
  const emp = await pool.query(`SELECT hourly_rate FROM employees WHERE id = $1`, [employeeId]);
  return num(emp.rows[0]?.hourly_rate) || PAYE_RATE;
}

type SplitPiece = {
  hours: number;
  rate: number;
  expense: number;
  bucket: WageBucket;
  payeeToClaim: boolean;
};

function splitHours(params: {
  hours: number;
  ruleValue: string;
  source: string;
  selfRate: number;
  wageBucketHint?: string | null;
}): SplitPiece[] {
  const def = getRuleDef(params.ruleValue);
  const payeBucket = payeBucketForSource(params.source, params.wageBucketHint);
  const hours = params.hours;
  const selfRate = params.selfRate > 0 ? params.selfRate : PAYE_RATE;

  if (def.mode === "full_paye") {
    return [{ hours, rate: PAYE_RATE, expense: 0, bucket: payeBucket, payeeToClaim: true }];
  }
  if (def.mode === "full_paye_rate") {
    const rate = def.restRate || 10.9;
    return [{ hours, rate, expense: 0, bucket: payeBucket, payeeToClaim: true }];
  }
  if (def.mode === "full_self") {
    return [selfEmployedPiece(hours, selfRate)];
  }
  if (def.mode === "full_self_rate" || params.ruleValue === "low_rates") {
    const bookRate = def.mode === "full_self_rate" ? (def.restRate || selfRate) : selfRate;
    return [selfEmployedPiece(hours, bookRate)];
  }

  // NI + Rest handled in applyRulesForOfficer (whole-shift tagging).
  return [{ hours, rate: PAYE_RATE, expense: 0, bucket: payeBucket, payeeToClaim: true }];
}

/** Whole shift stays PAYE while cumulative ≤ NI cap; else whole shift → Self at rest rate. */
function tagWholeShiftNi(params: {
  hours: number;
  cumulativeAfter: number;
  niCap: number;
  source: string;
  selfRate: number;
  restBookRate: number | null;
  wageBucketHint?: string | null;
}): SplitPiece {
  const payeBucket = payeBucketForSource(params.source, params.wageBucketHint);
  if (params.cumulativeAfter <= params.niCap) {
    // NI / PAYE portion @ £12.71
    return { hours: params.hours, rate: PAYE_RATE, expense: 0, bucket: payeBucket, payeeToClaim: true };
  }
  // Rest → Self-employed at rest rate (e.g. 10.50). Rate stays £12.71; gap is a deduction.
  const bookRate = params.restBookRate ?? (params.selfRate > 0 ? params.selfRate : PAYE_RATE);
  return selfEmployedPiece(params.hours, bookRate);
}

function selfEmployedPiece(hours: number, bookRate: number): SplitPiece {
  const rate = bookRate > 0 ? bookRate : PAYE_RATE;
  if (rate + 0.001 < PAYE_RATE) {
    return {
      hours,
      rate: PAYE_RATE,
      expense: money(hours * (PAYE_RATE - rate)),
      bucket: "self",
      payeeToClaim: false,
    };
  }
  return { hours, rate, expense: 0, bucket: "self", payeeToClaim: false };
}

async function eligibleShifts(tenantId: number, employeeId: number, month: string) {
  const from = monthStart(month);
  const to = monthEnd(month);
  const { rows } = await pool.query(
    `SELECT s.*
     FROM shifts s
     WHERE s.tenant_id = $1 AND s.employee_id = $2
       AND s.date >= $3 AND s.date <= $4
       AND s.status IN ('verified', 'completed')
     ORDER BY s.date ASC, s.start_time ASC`,
    [tenantId, employeeId, from, to],
  );
  return rows;
}

export async function refreshMonthTotals(monthRowId: number) {
  const { rows } = await pool.query(
    `SELECT
        COALESCE(SUM(hours) FILTER (WHERE bucket = 'first4_paye'), 0) AS first4_hours,
        COALESCE(SUM(wages) FILTER (WHERE bucket = 'first4_paye'), 0) AS first4_wages,
        COALESCE(SUM(hours) FILTER (WHERE bucket = 'gfm_paye'), 0) AS gfm_hours,
        COALESCE(SUM(wages) FILTER (WHERE bucket = 'gfm_paye'), 0) AS gfm_wages,
        COALESCE(SUM(hours) FILTER (WHERE bucket = 'self'), 0) AS self_hours,
        COALESCE(SUM(wages) FILTER (WHERE bucket = 'self'), 0) AS self_wages
     FROM payroll_applied_lines WHERE month_row_id = $1`,
    [monthRowId],
  );
  const t = rows[0] || {};
  await pool.query(
    `UPDATE payroll_control_months SET
       first4_hours = $2, first4_wages = $3,
       gfm_hours = $4, gfm_wages = $5,
       self_hours = $6, self_wages = $7,
       updated_at = NOW()
     WHERE id = $1`,
    [monthRowId, t.first4_hours, t.first4_wages, t.gfm_hours, t.gfm_wages, t.self_hours, t.self_wages],
  );
}

export async function applyRulesForOfficer(opts: {
  tenantId: number;
  employeeId: number;
  month: string;
}): Promise<{ applied: number; skipped: string | null }> {
  const monthRow = await ensureMonthRow(opts.tenantId, opts.employeeId, opts.month);
  if (monthRow.hr_status === "hold") {
    return { applied: 0, skipped: "HR hold" };
  }

  const billed = await pool.query(
    `SELECT DISTINCT shift_id FROM payroll_applied_lines WHERE month_row_id = $1 AND billed = true`,
    [monthRow.id],
  );
  const billedShiftIds = new Set(billed.rows.map((r: any) => Number(r.shift_id)));

  await pool.query(
    `DELETE FROM payroll_applied_lines WHERE month_row_id = $1 AND billed = false`,
    [monthRow.id],
  );

  const shifts = (await eligibleShifts(opts.tenantId, opts.employeeId, opts.month))
    .filter((s: any) => !billedShiftIds.has(Number(s.id)));

  const def = getRuleDef(monthRow.rules_of_payment);
  const isNiRest = def.mode === "ni_rest";
  const niCap = Math.max(0, (def.niCap || 0) - Number(monthRow.ni_used || 0));
  let cumulative = 0;
  let applied = 0;

  const sourceRow = await pool.query(
    `SELECT wage_bucket FROM tenant_payroll_sources WHERE tenant_id = $1 AND value = $2 LIMIT 1`,
    [opts.tenantId, monthRow.payroll_source],
  );
  const wageBucketHint = sourceRow.rows[0]?.wage_bucket as string | undefined;

  for (const shift of shifts) {
    const hours = shiftHours(shift.start_time, shift.end_time, shift.break_minutes);
    if (hours <= 0) continue;
    const selfRate = await selfRateForShift(opts.tenantId, opts.employeeId, shift);

    let pieces: SplitPiece[];
    if (isNiRest) {
      // PHP apply_rules.php: add shift hours, then if cumulative ≤ NI cap → whole shift PAYE, else whole Self.
      cumulative = money(cumulative + hours);
      pieces = [tagWholeShiftNi({
        hours,
        cumulativeAfter: cumulative,
        niCap,
        source: monthRow.payroll_source,
        selfRate,
        restBookRate: def.restRate,
        wageBucketHint,
      })];
    } else {
      pieces = splitHours({
        hours,
        ruleValue: monthRow.rules_of_payment,
        source: monthRow.payroll_source,
        selfRate,
        wageBucketHint,
      });
    }

    for (const piece of pieces) {
      if (piece.hours <= 0) continue;
      const wages = money(piece.hours * piece.rate - (piece.expense || 0));
      await pool.query(
        `INSERT INTO payroll_applied_lines
          (tenant_id, month_row_id, employee_id, shift_id, hours, holiday_hours, rate, expense, wages, bucket, payee_to_claim, claimable, billed)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,true,false)`,
        [
          opts.tenantId, monthRow.id, opts.employeeId, shift.id,
          piece.hours, piece.rate, piece.expense, wages, piece.bucket, piece.payeeToClaim,
        ],
      );
      applied += 1;
    }
  }

  await refreshMonthTotals(monthRow.id);
  return { applied, skipped: null };
}

export async function openRuleRequest(opts: {
  tenantId: number;
  monthRowId: number;
  toRule: string;
  toSource: string;
  userId: string;
}) {
  const month = await pool.query(`SELECT * FROM payroll_control_months WHERE id = $1 AND tenant_id = $2`, [
    opts.monthRowId, opts.tenantId,
  ]);
  const row = month.rows[0];
  if (!row) throw new Error("Officer month not found");
  if (row.rules_of_payment === opts.toRule && row.payroll_source === opts.toSource) {
    throw new Error("No change from the live rule");
  }

  const ruleChanging = row.rules_of_payment !== opts.toRule;
  const sourceChanging = row.payroll_source !== opts.toSource;

  // Keep rule-only and NI-source-only requests independent; do not close self-source requests.
  if (ruleChanging && sourceChanging) {
    await pool.query(
      `UPDATE payroll_rule_change_requests SET resolved_at = NOW()
       WHERE month_row_id = $1 AND resolved_at IS NULL
         AND COALESCE(source_scope, 'ni') = 'ni'`,
      [opts.monthRowId],
    );
  } else if (ruleChanging) {
    await pool.query(
      `UPDATE payroll_rule_change_requests SET resolved_at = NOW()
       WHERE month_row_id = $1 AND resolved_at IS NULL
         AND COALESCE(source_scope, 'ni') = 'ni'
         AND from_rule IS DISTINCT FROM to_rule`,
      [opts.monthRowId],
    );
  } else if (sourceChanging) {
    await pool.query(
      `UPDATE payroll_rule_change_requests SET resolved_at = NOW()
       WHERE month_row_id = $1 AND resolved_at IS NULL
         AND COALESCE(source_scope, 'ni') = 'ni'
         AND from_rule IS NOT DISTINCT FROM to_rule
         AND from_source IS DISTINCT FROM to_source`,
      [opts.monthRowId],
    );
  }

  const inserted = await pool.query(
    `INSERT INTO payroll_rule_change_requests
      (tenant_id, month_row_id, from_rule, from_source, to_rule, to_source, source_scope, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'ni',$7) RETURNING *`,
    [
      opts.tenantId,
      opts.monthRowId,
      row.rules_of_payment,
      row.payroll_source,
      opts.toRule,
      opts.toSource,
      opts.userId,
    ],
  );
  return inserted.rows[0];
}

export async function openSelfSourceRequest(opts: {
  tenantId: number;
  monthRowId: number;
  toSelfSource: string;
  userId: string;
}) {
  const month = await pool.query(`SELECT * FROM payroll_control_months WHERE id = $1 AND tenant_id = $2`, [
    opts.monthRowId, opts.tenantId,
  ]);
  const row = month.rows[0];
  if (!row) throw new Error("Officer month not found");
  const currentSelf = row.self_payroll_source || "self_employed";
  if (currentSelf === opts.toSelfSource) {
    throw new Error("No change from the live self source");
  }

  await pool.query(
    `UPDATE payroll_rule_change_requests SET resolved_at = NOW()
     WHERE month_row_id = $1 AND resolved_at IS NULL AND source_scope = 'self'`,
    [opts.monthRowId],
  );

  const inserted = await pool.query(
    `INSERT INTO payroll_rule_change_requests
      (tenant_id, month_row_id, from_rule, from_source, to_rule, to_source, source_scope, created_by)
     VALUES ($1,$2,$3,$4,$3,$5,'self',$6) RETURNING *`,
    [
      opts.tenantId,
      opts.monthRowId,
      row.rules_of_payment,
      currentSelf,
      opts.toSelfSource,
      opts.userId,
    ],
  );
  return inserted.rows[0];
}

export async function decideRuleRequest(opts: {
  tenantId: number;
  requestId: number;
  column: "control" | "hr" | "accounts";
  decision: "approved" | "denied";
  userId: string;
}) {
  const found = await pool.query(
    `SELECT r.*, m.rules_of_payment, m.payroll_source, m.self_payroll_source
     FROM payroll_rule_change_requests r
     JOIN payroll_control_months m ON m.id = r.month_row_id
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [opts.requestId, opts.tenantId],
  );
  const req = found.rows[0];
  if (!req) throw new Error("Request not found");
  if (req.resolved_at) throw new Error("Request already resolved");

  const existing =
    opts.column === "control" ? req.control_status : opts.column === "hr" ? req.hr_status : req.accounts_status;
  if (existing && existing !== "pending") {
    throw new Error(`${opts.column} already ${existing}`);
  }

  const col = opts.column === "control" ? "control_status" : opts.column === "hr" ? "hr_status" : "accounts_status";
  const by = opts.column === "control" ? "control_by" : opts.column === "hr" ? "hr_by" : "accounts_by";
  await pool.query(
    `UPDATE payroll_rule_change_requests SET ${col} = $2, ${by} = $3 WHERE id = $1`,
    [opts.requestId, opts.decision, opts.userId],
  );
  const updated = await pool.query(`SELECT * FROM payroll_rule_change_requests WHERE id = $1`, [opts.requestId]);
  const row = updated.rows[0];

  if (opts.decision === "denied") {
    await pool.query(
      `UPDATE payroll_rule_change_requests SET resolved_at = NOW() WHERE id = $1`,
      [opts.requestId],
    );
    return { ...row, applied: false, outcome: "denied" };
  }

  const approvedCount = ["control_status", "hr_status", "accounts_status"].filter(
    (k) => row[k] === "approved",
  ).length;

  // Live once any 2 of Control / HR / Accounts have approved.
  if (approvedCount >= 2) {
    const sets: string[] = ["updated_at = NOW()"];
    const params: any[] = [row.month_row_id];
    const scope = row.source_scope || "ni";
    if (scope === "self") {
      if (row.from_source !== row.to_source) {
        params.push(row.to_source);
        sets.push(`self_payroll_source = $${params.length}`);
      }
    } else {
      if (row.from_rule !== row.to_rule) {
        params.push(row.to_rule);
        sets.push(`rules_of_payment = $${params.length}`);
      }
      if (row.from_source !== row.to_source) {
        params.push(row.to_source);
        sets.push(`payroll_source = $${params.length}`);
      }
    }
    if (sets.length > 1) {
      await pool.query(
        `UPDATE payroll_control_months SET ${sets.join(", ")} WHERE id = $1`,
        params,
      );
    }
    await pool.query(
      `UPDATE payroll_rule_change_requests SET resolved_at = NOW() WHERE id = $1`,
      [opts.requestId],
    );
    return { ...row, applied: true, outcome: "approved" };
  }
  return { ...row, applied: false, outcome: "pending" };
}

export type ClaimablePayee = {
  employeeId: number;
  payeeName: string;
  shiftCount: number;
  amount: number;
  source: string;
  branchType: string;
  accountTitle: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  bankName: string | null;
  niNumber: string | null;
  empLevel: number;
  payrollProvider: string | null;
  lineIds: number[];
  lines: any[];
};

export async function listClaimable(opts: {
  tenantId: number;
  claimFrom: string;
  claimTo: string;
  payeeType: "PAYE" | "Self-employed";
  branch: "ALL" | "MAIN" | "Contractor";
  provider?: string | null;
}): Promise<ClaimablePayee[]> {
  const payeeToClaim = opts.payeeType === "PAYE";
  const accountPurpose = payeeToClaim ? "payee" : "self";
  const params: any[] = [opts.tenantId, opts.claimFrom, opts.claimTo, payeeToClaim, accountPurpose];
  let branchSql = "";
  if (opts.branch === "MAIN") branchSql = "AND e.supplier_id IS NULL";
  if (opts.branch === "Contractor") branchSql = "AND e.supplier_id IS NOT NULL";
  let providerSql = "";
  if (opts.provider && opts.provider !== "ALL") {
    params.push(opts.provider);
    // PAYE bills filter NI source; Self bills filter self source
    providerSql = payeeToClaim
      ? `AND m.payroll_source = $${params.length}`
      : `AND COALESCE(NULLIF(m.self_payroll_source, ''), m.payroll_source) = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT l.*, s.date AS shift_date, s.start_time, s.end_time, s.title,
            st.name AS site_name,
            e.employee_number, e.external_id, e.national_insurance, e.officer_step, e.supplier_id,
            u.first_name, u.last_name,
            COALESCE(bp.account_name, bd.account_name) AS account_name,
            COALESCE(bp.account_number, bd.account_number) AS account_number,
            COALESCE(bp.sort_code, bd.sort_code) AS sort_code,
            COALESCE(bp.bank_name, bd.bank_name) AS bank_name,
            CASE WHEN $4::boolean THEN m.payroll_source
                 ELSE COALESCE(NULLIF(m.self_payroll_source, ''), m.payroll_source)
            END AS payroll_source
     FROM payroll_applied_lines l
     JOIN payroll_control_months m ON m.id = l.month_row_id
     JOIN shifts s ON s.id = l.shift_id
     LEFT JOIN sites st ON st.id = s.site_id
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN bank_details bp ON bp.employee_id = e.id AND bp.account_purpose = $5
     LEFT JOIN bank_details bd ON bd.employee_id = e.id AND bd.account_purpose = 'default'
     WHERE l.tenant_id = $1
       AND l.claimable = true AND l.billed = false
       AND l.payee_to_claim = $4
       AND s.date >= $2 AND s.date <= $3
       ${branchSql} ${providerSql}
     ORDER BY u.last_name, u.first_name, s.date, s.start_time`,
    params,
  );

  const byEmp = new Map<number, ClaimablePayee>();
  for (const r of rows) {
    const empId = Number(r.employee_id);
    let group = byEmp.get(empId);
    if (!group) {
      group = {
        employeeId: empId,
        payeeName: `${r.first_name || ""} ${r.last_name || ""}`.trim() || `Officer ${empId}`,
        shiftCount: 0,
        amount: 0,
        source: r.payroll_source,
        branchType: r.supplier_id ? "Contractor" : "MAIN",
        accountTitle: r.account_name,
        accountNumber: r.account_number,
        sortCode: r.sort_code,
        bankName: r.bank_name,
        niNumber: r.national_insurance,
        empLevel: Number(r.officer_step || 0),
        payrollProvider: r.payroll_source,
        lineIds: [],
        lines: [],
      };
      byEmp.set(empId, group);
    }
    group.shiftCount += 1;
    group.amount = money(group.amount + num(r.wages));
    group.lineIds.push(Number(r.id));
    group.lines.push(r);
  }
  return Array.from(byEmp.values());
}

export async function createBills(opts: {
  tenantId: number;
  employeeIds: number[];
  claimFrom: string;
  claimTo: string;
  dueDate: string;
  payeeType: "PAYE" | "Self-employed";
  branch: "ALL" | "MAIN" | "Contractor";
  provider?: string | null;
  userId: string;
}) {
  if (opts.dueDate < opts.claimTo) {
    throw new Error("Due date cannot be before the bill date (claim to).");
  }
  const payees = await listClaimable(opts);
  const wanted = new Set(opts.employeeIds.map(Number));
  const labelRows = await pool.query(
    `SELECT value, label FROM tenant_payroll_sources WHERE tenant_id = $1`,
    [opts.tenantId],
  );
  const labelByValue = new Map(labelRows.rows.map((r: any) => [r.value, r.label]));
  const created: any[] = [];
  for (const payee of payees) {
    if (!wanted.has(payee.employeeId)) continue;
    if (!payee.accountNumber || !payee.accountTitle) {
      const kind = opts.payeeType === "PAYE" ? "Payee" : "Self";
      throw new Error(`No ${kind} bank account on file for ${payee.payeeName}`);
    }
    if (payee.amount <= 0 || payee.lineIds.length === 0) {
      throw new Error(`No claimable shifts for ${payee.payeeName}`);
    }
    const billNumber = await nextBillNumber(opts.tenantId);
    const bill = await pool.query(
      `INSERT INTO payroll_bills
        (tenant_id, bill_number, employee_id, bill_date, due_date, claim_from, claim_to,
         payee_type, branch_type, payroll_provider, emp_level, particulars,
         account_title, account_number, sort_code, bank_name, ni_number,
         bill_amount, paid_amount, balance, status, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,0,$18,'UNPAID',$19,$20)
       RETURNING *`,
      [
        opts.tenantId, billNumber, payee.employeeId, opts.claimTo, opts.dueDate, opts.claimFrom, opts.claimTo,
        opts.payeeType, payee.branchType, opts.provider && opts.provider !== "ALL" ? opts.provider : payee.source,
        payee.empLevel, `${opts.payeeType} ${opts.claimFrom} to ${opts.claimTo}`,
        payee.accountTitle, payee.accountNumber, payee.sortCode, payee.bankName, payee.niNumber,
        payee.amount, sourceLabelSafe(payee.source, labelByValue.get(payee.source)), opts.userId,
      ],
    );
    const billId = bill.rows[0].id;
    for (const line of payee.lines) {
      await pool.query(
        `INSERT INTO payroll_bill_lines (bill_id, applied_line_id, shift_id, hours, holiday_hours, rate, wages)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [billId, line.id, line.shift_id, line.hours, line.holiday_hours || 0, line.rate, line.wages],
      );
      await pool.query(`UPDATE payroll_applied_lines SET billed = true WHERE id = $1`, [line.id]);
    }
    created.push(bill.rows[0]);
  }
  if (created.length === 0) throw new Error("No payees ticked with claimable shifts");
  return created;
}

function sourceLabelSafe(value: string, customLabel?: string | null): string {
  if (customLabel) return customLabel;
  if (value === "first4_paye") return "1st4 PAYE";
  if (value === "gfm_paye") return "GFM PAYE";
  if (value === "self_employed") return "Self-employed";
  return value;
}

export async function changeClaimableSource(opts: {
  tenantId: number;
  employeeId: number;
  claimFrom: string;
  claimTo: string;
  payeeType: "PAYE" | "Self-employed";
  toSource: string;
}) {
  const sourceOk = await pool.query(
    `SELECT value FROM tenant_payroll_sources WHERE tenant_id = $1 AND value = $2 LIMIT 1`,
    [opts.tenantId, opts.toSource],
  );
  if (!sourceOk.rows[0]) {
    const builtIn = ["first4_paye", "gfm_paye", "self_employed"].includes(opts.toSource);
    if (!builtIn) throw new Error("Unknown payroll source");
  }

  const payeeToClaim = opts.payeeType === "PAYE";
  const { rows } = await pool.query(
    `SELECT DISTINCT m.id AS month_id, m.period_month, m.employee_id, m.payroll_source, m.self_payroll_source
     FROM payroll_applied_lines l
     JOIN payroll_control_months m ON m.id = l.month_row_id
     JOIN shifts s ON s.id = l.shift_id
     WHERE l.tenant_id = $1
       AND l.employee_id = $2
       AND l.claimable = true AND l.billed = false
       AND l.payee_to_claim = $3
       AND s.date >= $4 AND s.date <= $5`,
    [opts.tenantId, opts.employeeId, payeeToClaim, opts.claimFrom, opts.claimTo],
  );
  if (rows.length === 0) throw new Error("No claimable shifts found for this payee");

  let updatedMonths = 0;
  for (const row of rows) {
    const currentSource = opts.payeeType === "PAYE"
      ? row.payroll_source
      : (row.self_payroll_source || row.payroll_source);
    if (currentSource === opts.toSource) continue;
    if (opts.payeeType === "PAYE") {
      await pool.query(
        `UPDATE payroll_control_months SET payroll_source = $2, updated_at = NOW() WHERE id = $1`,
        [row.month_id, opts.toSource],
      );
      const period = String(row.period_month).slice(0, 7);
      await applyRulesForOfficer({
        tenantId: opts.tenantId,
        employeeId: opts.employeeId,
        month: period,
      });
    } else {
      await pool.query(
        `UPDATE payroll_control_months SET self_payroll_source = $2, updated_at = NOW() WHERE id = $1`,
        [row.month_id, opts.toSource],
      );
    }
    updatedMonths += 1;
  }
  return { updatedMonths, toSource: opts.toSource };
}

export async function markBillPaid(opts: {
  tenantId: number;
  billId: number;
  paidAmount: number;
  postDate: string | null;
  bankName: string | null;
  remittance: boolean;
  remarks?: string | null;
  userId: string;
}) {
  const found = await pool.query(
    `SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`,
    [opts.billId, opts.tenantId],
  );
  const bill = found.rows[0];
  if (!bill) throw new Error("Bill not found");
  const billAmount = num(bill.bill_amount);
  const alreadyPaid = num(bill.paid_amount);
  const paying = money(opts.paidAmount);
  if (paying < 0) throw new Error("Paid amount cannot be negative");
  if (alreadyPaid + paying > billAmount + 0.001) throw new Error("Paid amount cannot exceed bill amount");

  const bankName = opts.bankName ?? bill.bank_name;
  if (paying > 0 && !bankName) throw new Error("Bank is required when paying more than 0");
  if (paying > 0 && !opts.postDate) throw new Error("Post date is required when paying more than 0");

  const newPaid = money(alreadyPaid + paying);
  const balance = money(billAmount - newPaid);
  const status = newPaid >= billAmount - 0.001 && paying > 0 ? "PAID" : "UNPAID";

  await pool.query(
    `UPDATE payroll_bills SET
       paid_amount = $2, balance = $3, status = $4,
       bank_name = COALESCE($5, bank_name),
       post_date = COALESCE($6::date, post_date),
       remittance = $7,
       remarks = COALESCE($8, remarks),
       updated_at = NOW()
     WHERE id = $1`,
    [opts.billId, newPaid, balance, status, bankName, opts.postDate, opts.remittance, opts.remarks ?? null],
  );

  if (paying > 0) {
    await pool.query(
      `INSERT INTO payroll_payments (tenant_id, bill_id, payment_type, amount, post_date, bank_name, created_by)
       VALUES ($1,$2,'PMT',$3,$4,$5,$6)`,
      [opts.tenantId, opts.billId, paying, opts.postDate, bankName, opts.userId],
    );
  }

  const updated = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1`, [opts.billId]);
  return { bill: updated.rows[0], paidNow: paying, insertedPayment: paying > 0 };
}

export async function deleteBill(opts: { tenantId: number; billId: number }) {
  const found = await pool.query(
    `SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`,
    [opts.billId, opts.tenantId],
  );
  const bill = found.rows[0];
  if (!bill) throw new Error("Bill not found");

  const lines = await pool.query(
    `SELECT applied_line_id FROM payroll_bill_lines WHERE bill_id = $1`,
    [opts.billId],
  );
  const appliedIds = lines.rows.map((r: any) => Number(r.applied_line_id)).filter(Boolean);

  await pool.query(`DELETE FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
    opts.billId,
    opts.tenantId,
  ]);

  if (appliedIds.length > 0) {
    await pool.query(
      `UPDATE payroll_applied_lines SET billed = false WHERE id = ANY($1::int[])`,
      [appliedIds],
    );
  }

  return { deleted: true, billNumber: bill.bill_number, releasedLines: appliedIds.length };
}

export async function deleteBills(opts: { tenantId: number; billIds: number[] }) {
  const ids = [...new Set(opts.billIds.map(Number).filter((n) => !Number.isNaN(n)))];
  if (ids.length === 0) throw new Error("No bills selected");
  const results = [];
  for (const billId of ids) {
    results.push(await deleteBill({ tenantId: opts.tenantId, billId }));
  }
  return results;
}

export async function loadBillReview(tenantId: number, billId: number) {
  const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [billId, tenantId]);
  if (!bill.rows[0]) throw new Error("Bill not found");
  const { rows } = await pool.query(
    `SELECT bl.*, s.date, s.start_time, s.end_time, s.title,
            st.name AS site_name, u.first_name, u.last_name, e.employee_number
     FROM payroll_bill_lines bl
     JOIN shifts s ON s.id = bl.shift_id
     LEFT JOIN sites st ON st.id = s.site_id
     JOIN payroll_bills b ON b.id = bl.bill_id
     JOIN employees e ON e.id = b.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE bl.bill_id = $1
     ORDER BY s.date, s.start_time`,
    [billId],
  );
  return { bill: bill.rows[0], lines: rows };
}
