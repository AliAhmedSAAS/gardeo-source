import type { Express, Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";
import { pool } from "./db";
import { sendSMS } from "./twilio-service";
import { sendViaTenantEmailSettings } from "./tenant-email-settings";
import {
  PAYROLL_CONTROL_VIEW_ROLES,
  FINANCE_ROLES,
  ADMIN_ROLES,
  currentPayrollMonth,
  monthStart,
  monthEnd,
  isFinanceRole,
  isAdminRole,
  canControlApprove,
  canHrApprove,
  canAccountsApprove,
  canHrHold,
  canControllerRemarks,
  canAccountsRemarks,
  PAYE_RATE,
  getRuleDef,
} from "@shared/payrollControl";
import {
  applyRulesForOfficer,
  ensureMonthRow,
  openRuleRequest,
  decideRuleRequest,
  listClaimable,
  createBills,
  markBillPaid,
  loadBillReview,
  deleteBill,
  deleteBills,
  changeClaimableSource,
  openSelfSourceRequest,
  num,
  money,
  shiftHours,
} from "./payroll-control";
import { generatePayslipPdf, generateRemittanceAdvicePdf } from "./payroll-control-pdf";

type RequireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;

function paramId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(String(raw || ""), 10);
}

const VIEW_ROLES = [...PAYROLL_CONTROL_VIEW_ROLES];
const MONEY_ROLES = [...FINANCE_ROLES, ...ADMIN_ROLES];

async function requireCustomPayroll(req: Request, res: Response): Promise<{ user: User; tenantId: number } | null> {
  const user = req.user as User;
  if (!user?.tenantId && user?.role !== "super_admin") {
    res.status(400).json({ message: "No tenant assigned" });
    return null;
  }
  const tenantId = user.tenantId;
  if (!tenantId) {
    res.status(400).json({ message: "No tenant assigned" });
    return null;
  }
  const tenant = await storage.getTenant(tenantId);
  if (!tenant?.customPayrollControlEnabled) {
    res.status(403).json({ message: "Custom payroll control is not enabled for this tenant" });
    return null;
  }
  return { user, tenantId };
}

function financeOnly(user: User, res: Response): boolean {
  if (isFinanceRole(user.role) || isAdminRole(user.role)) return true;
  res.status(403).json({ message: "Finance/Admin only" });
  return false;
}

function widOf(emp: { employee_number?: string | null; external_id?: string | null; id: number }): string {
  return emp.employee_number || emp.external_id || String(emp.id);
}

async function storePdf(kind: string, buffer: Buffer): Promise<string | null> {
  try {
    const { ObjectStorageService, objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const svc = new ObjectStorageService();
    const privateDir = svc.getPrivateObjectDir();
    const dirParts = privateDir.split("/").filter(Boolean);
    const bucketName = dirParts[0];
    const basePath = dirParts.slice(1).join("/");
    const { randomUUID } = await import("crypto");
    const uuid = randomUUID();
    const objectName = `${basePath}/payroll-control/${kind}/${uuid}.pdf`;
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    await file.save(buffer, { contentType: "application/pdf" });
    return `/objects/payroll-control/${kind}/${uuid}.pdf`;
  } catch (err: any) {
    console.error("[payroll-control] PDF storage failed:", err?.message);
    return null;
  }
}

async function officerContact(employeeId: number) {
  const { rows } = await pool.query(
    `SELECT e.id, e.phone, e.portal_email, e.national_insurance, e.employee_number,
            u.first_name, u.last_name, u.email, u.phone AS user_phone
     FROM employees e LEFT JOIN users u ON u.id = e.user_id WHERE e.id = $1`,
    [employeeId],
  );
  return rows[0] || null;
}

async function payslipPayload(tenantId: number, billId: number) {
  const { bill, lines } = await loadBillReview(tenantId, billId);
  if (!lines.length) throw new Error("Don't generate a payslip for a bill with no shifts");
  const tenant = await storage.getTenant(tenantId);
  const contact = await officerContact(bill.employee_id);
  const hours = lines.reduce((s: number, l: any) => s + num(l.hours), 0);
  const expenseRows = await pool.query(
    `SELECT COALESCE(SUM(l.expense),0) AS expense
     FROM payroll_applied_lines l
     JOIN payroll_bill_lines bl ON bl.applied_line_id = l.id
     WHERE bl.bill_id = $1`,
    [billId],
  );
  return {
    companyName: tenant?.name || "Gardeo",
    billNumber: bill.bill_number,
    officerName: contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Officer",
    niNumber: contact?.national_insurance || bill.ni_number,
    periodFrom: String(bill.claim_from).slice(0, 10),
    periodTo: String(bill.claim_to).slice(0, 10),
    hours: money(hours),
    rate: lines[0]?.rate || "0",
    expense: num(expenseRows.rows[0]?.expense),
    gross: num(bill.bill_amount),
    remarks: bill.remarks,
    provider: bill.payroll_provider,
    paymentDate: bill.post_date ? String(bill.post_date).slice(0, 10) : null,
    lines: lines.map((l: any) => ({
      date: String(l.date).slice(0, 10),
      site: l.site_name || l.title || "",
      inTime: l.start_time,
      outTime: l.end_time,
      hours: num(l.hours),
      rate: l.rate,
      wages: num(l.wages),
    })),
    email: contact?.email || contact?.portal_email,
    phone: contact?.phone || contact?.user_phone,
    employeeId: bill.employee_id,
    bill,
  };
}

async function sendRemittance(tenantId: number, bill: any, userId: string) {
  const contact = await officerContact(bill.employee_id);
  const tenant = await storage.getTenant(tenantId);
  const amount = num(bill.paid_amount) > 0 ? num(bill.paid_amount) : num(bill.bill_amount);
  const pdf = await generateRemittanceAdvicePdf({
    companyName: tenant?.name || "Gardeo",
    billNumber: bill.bill_number,
    officerName: contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Officer",
    amount,
    postDate: String(bill.post_date || bill.bill_date || "").slice(0, 10),
    bankName: bill.bank_name,
    accountTitle: bill.account_title,
    accountNumber: bill.account_number,
    sortCode: bill.sort_code,
  });
  const to = contact?.email || contact?.portal_email;
  if (!to) throw new Error("No email address for remittance");
  const filename = `remittance-${bill.bill_number}.pdf`;
  const sent = await sendViaTenantEmailSettings({
    tenantId,
    to,
    subject: `Remittance advice ${bill.bill_number}`,
    html: `<p>Dear ${contact ? `${contact.first_name || ""}`.trim() || "Officer" : "Officer"},</p>
<p>Please find attached remittance advice for bill <strong>${bill.bill_number}</strong> (${gbp(amount)}).</p>
<p>Regards,<br/>${tenant?.name || "Payroll"}</p>`,
    attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
  });
  await pool.query(
    `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, subject, body, error_message, created_by)
     VALUES ($1,$2,'remittance',$3,$4,$5,$6,$7)`,
    [tenantId, bill.id, sent.ok ? "sent" : "failed", `Remittance ${bill.bill_number}`, null, sent.error || null, userId],
  );
  if (!sent.ok) throw new Error(sent.error || "Remittance email failed");
  await pool.query(
    `UPDATE payroll_bills SET remittance = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [bill.id, tenantId],
  );
  return { ok: true, to, amount };
}

export function registerPayrollControlRoutes(app: Express, requireRole: RequireRole) {
  app.get("/api/payroll-control/summary", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const month = String(req.query.month || currentPayrollMonth());
      // Search is applied client-side; keep param for backwards compat but do not force full recompute.
      const search = String(req.query.search || "").trim().toLowerCase();
      const rule = String(req.query.rule || "ALL");
      const source = String(req.query.source || "ALL");
      const from = monthStart(month);
      const to = monthEnd(month);

      // Fast path: eligible employees = those with verified/completed shifts in month
      // OR an existing payroll_control_months row (no correlated EXISTS per employee).
      const { rows } = await pool.query(
        `WITH eligible AS (
           SELECT DISTINCT sh.employee_id
           FROM shifts sh
           WHERE sh.tenant_id = $1
             AND sh.date >= $2 AND sh.date <= $3
             AND sh.status IN ('verified','completed')
             AND sh.employee_id IS NOT NULL
           UNION
           SELECT m.employee_id
           FROM payroll_control_months m
           WHERE m.tenant_id = $1 AND m.period_month = $2
         )
         SELECT e.id AS employee_id, e.employee_number, e.external_id, e.employment_type, e.officer_step,
                e.national_insurance, e.supplier_id, e.hourly_rate,
                u.first_name, u.last_name,
                s.company_name AS agent_name,
                b.account_name, b.account_number, b.sort_code, b.bank_name,
                m.id AS month_id, m.rules_of_payment, m.payroll_source, m.self_payroll_source, m.ni_used, m.hr_status,
                m.remarks, m.accounts_remarks, m.first4_hours, m.first4_wages, m.first4_paid,
                m.gfm_hours, m.gfm_wages, m.gfm_paid, m.self_hours, m.self_wages, m.self_paid
         FROM eligible el
         JOIN employees e ON e.id = el.employee_id
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN bank_details b ON b.employee_id = e.id AND b.account_purpose = 'default'
         LEFT JOIN payroll_control_months m
           ON m.employee_id = e.id AND m.tenant_id = e.tenant_id AND m.period_month = $2
         WHERE e.tenant_id = $1 AND COALESCE(e.is_merged, false) = false
         ORDER BY u.last_name NULLS LAST, u.first_name NULLS LAST, e.id`,
        [ctx.tenantId, from, to],
      );

      const monthIds = rows.map((r: any) => r.month_id).filter(Boolean);
      const requestsByMonth = new Map<number, any[]>();
      if (monthIds.length > 0) {
        const reqs = await pool.query(
          `SELECT id, month_row_id, from_rule, from_source, to_rule, to_source, source_scope,
                  control_status, hr_status, accounts_status
           FROM payroll_rule_change_requests
           WHERE resolved_at IS NULL AND month_row_id = ANY($1::int[])
           ORDER BY id ASC`,
          [monthIds],
        );
        for (const r of reqs.rows) {
          const list = requestsByMonth.get(Number(r.month_row_id)) || [];
          const scope = r.source_scope || "ni";
          let kind: "rule" | "source" | "self_source" | "both" = "source";
          if (scope === "self") {
            kind = "self_source";
          } else if (r.from_rule !== r.to_rule && r.from_source !== r.to_source) {
            kind = "both";
          } else if (r.from_rule !== r.to_rule) {
            kind = "rule";
          } else {
            kind = "source";
          }
          list.push({
            id: r.id,
            fromRule: r.from_rule,
            fromSource: r.from_source,
            toRule: r.to_rule,
            toSource: r.to_source,
            sourceScope: scope,
            controlStatus: r.control_status,
            hrStatus: r.hr_status,
            accountsStatus: r.accounts_status,
            kind,
          });
          requestsByMonth.set(Number(r.month_row_id), list);
        }
      }

      // Only load raw shifts for officers whose applied buckets are still empty
      // (skip when Apply Rules already filled month totals — big win).
      const needCoveredIds = rows
        .filter((r: any) => num(r.first4_hours) + num(r.gfm_hours) + num(r.self_hours) <= 0)
        .map((r: any) => Number(r.employee_id));

      const coveredByEmp = new Map<number, { hours: number; wages: number }>();
      if (needCoveredIds.length > 0) {
        const covered = await pool.query(
          `SELECT sh.employee_id, sh.start_time, sh.end_time, sh.break_minutes, sh.pay_rate, e.hourly_rate
           FROM shifts sh
           INNER JOIN employees e ON e.id = sh.employee_id
           WHERE sh.tenant_id = $1
             AND sh.date >= $2 AND sh.date <= $3
             AND sh.status IN ('verified','completed')
             AND sh.employee_id = ANY($4::int[])`,
          [ctx.tenantId, from, to, needCoveredIds],
        );
        for (const sh of covered.rows) {
          const hours = shiftHours(sh.start_time, sh.end_time, sh.break_minutes);
          if (hours <= 0) continue;
          const rate = num(sh.pay_rate) || num(sh.hourly_rate) || PAYE_RATE;
          const cur = coveredByEmp.get(Number(sh.employee_id)) || { hours: 0, wages: 0 };
          cur.hours = money(cur.hours + hours);
          cur.wages = money(cur.wages + hours * rate);
          coveredByEmp.set(Number(sh.employee_id), cur);
        }
      }

      let officers = rows.map((r: any) => {
        let first4Hours = num(r.first4_hours);
        let first4Wages = num(r.first4_wages);
        let gfmHours = num(r.gfm_hours);
        let gfmWages = num(r.gfm_wages);
        let selfHours = num(r.self_hours);
        let selfWages = num(r.self_wages);

        if (first4Hours + gfmHours + selfHours <= 0) {
          const cov = coveredByEmp.get(Number(r.employee_id));
          if (cov && cov.hours > 0) {
            const src = r.payroll_source || "first4_paye";
            const ruleVal = r.rules_of_payment || "full_paye";
            const mode = getRuleDef(ruleVal).mode;
            if (
              src === "self_employed" ||
              ruleVal === "low_rates" ||
              mode === "full_self" ||
              mode === "full_self_rate"
            ) {
              selfHours = cov.hours;
              selfWages = cov.wages;
            } else if (src === "gfm_paye") {
              gfmHours = cov.hours;
              gfmWages = cov.wages;
            } else {
              first4Hours = cov.hours;
              first4Wages = cov.wages;
            }
          }
        }

        return {
          employeeId: r.employee_id,
          monthId: r.month_id,
          wid: widOf(r),
          name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || `Officer ${r.employee_id}`,
          bank: [r.account_name, r.sort_code, r.account_number].filter(Boolean).join(" · ") || "—",
          empType: r.employment_type || "—",
          agent: r.agent_name || "In-house",
          hrStatus: r.hr_status || "approved",
          rulesOfPayment: r.rules_of_payment || "full_paye",
          payrollSource: r.payroll_source || "first4_paye",
          selfPayrollSource: r.self_payroll_source || r.payroll_source || "self_employed",
          niUsed: Number(r.ni_used || 0),
          first4Hours,
          first4Wages,
          first4Paid: !!r.first4_paid,
          gfmHours,
          gfmWages,
          gfmPaid: !!r.gfm_paid,
          selfHours,
          selfWages,
          selfPaid: !!r.self_paid,
          remarks: r.remarks,
          accountsRemarks: r.accounts_remarks,
          requests: r.month_id ? (requestsByMonth.get(Number(r.month_id)) || []) : [],
          request: (r.month_id ? (requestsByMonth.get(Number(r.month_id)) || [])[0] : null) || null,
        };
      });

      // Optional server-side filters (search usually done client-side now).
      if (search) {
        officers = officers.filter((o) =>
          o.name.toLowerCase().includes(search) || o.wid.toLowerCase().includes(search),
        );
      }
      if (rule !== "ALL") officers = officers.filter((o) => o.rulesOfPayment === rule);
      if (source !== "ALL") {
        officers = officers.filter((o) =>
          o.payrollSource === source || o.selfPayrollSource === source,
        );
      }

      const withHours = officers.filter((o) => o.first4Hours + o.gfmHours + o.selfHours > 0);
      const fullSelf = withHours.filter((o) => o.selfHours > 0 && o.first4Hours + o.gfmHours === 0).length;
      const partialSelf = withHours.filter((o) => o.selfHours > 0 && o.first4Hours + o.gfmHours > 0).length;
      const totalHours = withHours.reduce((s, o) => s + o.first4Hours + o.gfmHours + o.selfHours, 0);
      const niHours = withHours.reduce((s, o) => s + o.first4Hours + o.gfmHours, 0);
      const paidReady = withHours.filter((o) => {
        const buckets = [
          o.first4Hours > 0 ? o.first4Paid : true,
          o.gfmHours > 0 ? o.gfmPaid : true,
          o.selfHours > 0 ? o.selfPaid : true,
        ];
        return buckets.every(Boolean);
      }).length;
      const pct = (n: number, d: number) => (d ? money((n / d) * 100) : 0);

      res.json({
        month,
        officers,
        kpis: {
          fullSelfPct: pct(fullSelf, withHours.length),
          partialSelfPct: pct(partialSelf, withHours.length),
          niHoursPct: pct(niHours, totalHours),
          totalPayStatusPct: pct(paidReady, withHours.length),
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/months/:id/shifts", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const monthId = paramId(req.params.id);
      const bucket = req.query.bucket ? String(req.query.bucket) : "";
      const taggedOnly = req.query.tagged === "1" || req.query.tagged === "true";
      const month = await pool.query(
        `SELECT * FROM payroll_control_months WHERE id = $1 AND tenant_id = $2`,
        [monthId, ctx.tenantId],
      );
      if (!month.rows[0]) return res.status(404).json({ message: "Not found" });
      const row = month.rows[0];

      // Tagged / bucket clicks: read from applied lines (no JS date-range — avoids TZ bugs).
      if (bucket || taggedOnly) {
        const params: any[] = [monthId, ctx.tenantId];
        let bucketClause = "";
        if (bucket) {
          params.push(bucket);
          bucketClause = ` AND l.bucket = $${params.length}`;
        }
        const { rows } = await pool.query(
          `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, s.start_time, s.end_time, s.title, s.status, s.break_minutes,
                  st.name AS site_name, l.hours, l.rate, l.wages, l.expense, l.bucket, l.billed
           FROM payroll_applied_lines l
           JOIN shifts s ON s.id = l.shift_id
           LEFT JOIN sites st ON st.id = s.site_id
           WHERE l.month_row_id = $1 AND l.tenant_id = $2
             ${bucketClause}
           ORDER BY s.date, s.start_time, l.id`,
          params,
        );
        return res.json(rows);
      }

      // Details: all verified/completed shifts in the month (SQL date math, no locale strings).
      const { rows } = await pool.query(
        `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, s.start_time, s.end_time, s.title, s.status, s.break_minutes,
                st.name AS site_name, l.hours, l.rate, l.wages, l.expense, l.bucket, l.billed
         FROM shifts s
         LEFT JOIN sites st ON st.id = s.site_id
         LEFT JOIN payroll_applied_lines l ON l.shift_id = s.id AND l.month_row_id = $1
         WHERE s.tenant_id = $2 AND s.employee_id = $3
           AND s.date >= $4::date
           AND s.date < ($4::date + interval '1 month')
           AND s.status IN ('verified','completed')
         ORDER BY s.date, s.start_time`,
        [monthId, ctx.tenantId, row.employee_id, row.period_month],
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payroll-control/months/:id", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const monthId = paramId(req.params.id);
      const existing = await pool.query(
        `SELECT * FROM payroll_control_months WHERE id = $1 AND tenant_id = $2`,
        [monthId, ctx.tenantId],
      );
      if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
      const sets: string[] = [];
      const vals: any[] = [];
      const push = (col: string, val: unknown) => {
        vals.push(val);
        sets.push(`${col} = $${vals.length}`);
      };
      if (req.body.hrStatus !== undefined) {
        if (!canHrHold(ctx.user.role)) return res.status(403).json({ message: "HR only" });
        push("hr_status", req.body.hrStatus === "hold" ? "hold" : "approved");
      }
      if (req.body.remarks !== undefined) {
        if (!canControllerRemarks(ctx.user.role)) return res.status(403).json({ message: "Controller remarks only" });
        push("remarks", req.body.remarks);
      }
      if (req.body.accountsRemarks !== undefined) {
        if (!canAccountsRemarks(ctx.user.role)) return res.status(403).json({ message: "Accounts remarks only" });
        push("accounts_remarks", req.body.accountsRemarks);
      }
      if (req.body.niUsed !== undefined) {
        if (!isFinanceRole(ctx.user.role) && ctx.user.role !== "hr_manager" && ctx.user.role !== "admin" && ctx.user.role !== "tenant_admin") {
          return res.status(403).json({ message: "Not allowed" });
        }
        const ni = Number(req.body.niUsed);
        if (![0, 10, 20, 30, 40, 50, 60, 70].includes(ni)) {
          return res.status(400).json({ message: "NI used must be 0–70 step 10" });
        }
        push("ni_used", ni);
      }
      if (req.body.selfPayrollSource !== undefined) {
        return res.status(400).json({ message: "Self source changes require Control/HR/Accounts approval" });
      }
      if (req.body.first4Paid !== undefined || req.body.gfmPaid !== undefined || req.body.selfPaid !== undefined) {
        if (!financeOnly(ctx.user, res)) return;
        if (req.body.first4Paid !== undefined) push("first4_paid", !!req.body.first4Paid);
        if (req.body.gfmPaid !== undefined) push("gfm_paid", !!req.body.gfmPaid);
        if (req.body.selfPaid !== undefined) push("self_paid", !!req.body.selfPaid);
      }
      if (!sets.length) return res.json(existing.rows[0]);
      vals.push(monthId);
      const updated = await pool.query(
        `UPDATE payroll_control_months SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
        vals,
      );
      res.json(updated.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/months/ensure", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const row = await ensureMonthRow(ctx.tenantId, Number(req.body.employeeId), String(req.body.month || currentPayrollMonth()));
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/rule-requests", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const { monthId, toRule, toSource, toSelfSource, sourceScope } = req.body;
      if (sourceScope === "self" || toSelfSource) {
        const row = await openSelfSourceRequest({
          tenantId: ctx.tenantId,
          monthRowId: Number(monthId),
          toSelfSource: String(toSelfSource || toSource),
          userId: ctx.user.id,
        });
        return res.json(row);
      }
      const row = await openRuleRequest({
        tenantId: ctx.tenantId,
        monthRowId: Number(monthId),
        toRule: String(toRule),
        toSource: String(toSource),
        userId: ctx.user.id,
      });
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/rule-requests/:id/decide", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const column = req.body.column as "control" | "hr" | "accounts";
      const decision = req.body.decision as "approved" | "denied";
      if (!["control", "hr", "accounts"].includes(column)) {
        return res.status(400).json({ message: "column must be control, hr, or accounts" });
      }
      if (!["approved", "denied"].includes(decision)) {
        return res.status(400).json({ message: "decision must be approved or denied" });
      }
      if (column === "control" && !canControlApprove(ctx.user.role)) return res.status(403).json({ message: "Controller/Admin only" });
      if (column === "hr" && !canHrApprove(ctx.user.role)) return res.status(403).json({ message: "HR/Admin/Finance only" });
      if (column === "accounts" && !canAccountsApprove(ctx.user.role)) return res.status(403).json({ message: "Admin/Finance only" });
      const result = await decideRuleRequest({
        tenantId: ctx.tenantId,
        requestId: paramId(req.params.id),
        column,
        decision,
        userId: ctx.user.id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/apply-rules", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const month = String(req.body.month || currentPayrollMonth());
      const employeeIds: number[] = Array.isArray(req.body.employeeIds) ? req.body.employeeIds.map(Number) : [];
      if (!employeeIds.length) return res.status(400).json({ message: "Tick officers first" });
      const results = [];
      for (const employeeId of employeeIds) {
        await ensureMonthRow(ctx.tenantId, employeeId, month);
        results.push({ employeeId, ...(await applyRulesForOfficer({ tenantId: ctx.tenantId, employeeId, month })) });
      }
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/claimable", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const claimFrom = String(req.query.claimFrom || "");
      const claimTo = String(req.query.claimTo || "");
      const dueDate = String(req.query.dueDate || "");
      const payeeType = req.query.payeeType === "Self-employed" ? "Self-employed" : "PAYE";
      const branch = (["ALL", "MAIN", "Contractor"].includes(String(req.query.branch))
        ? String(req.query.branch)
        : "ALL") as "ALL" | "MAIN" | "Contractor";
      const provider = req.query.provider ? String(req.query.provider) : "ALL";
      if (!claimFrom || !claimTo) return res.status(400).json({ message: "claim from and claim to are required" });
      const payees = await listClaimable({
        tenantId: ctx.tenantId,
        claimFrom,
        claimTo,
        payeeType,
        branch,
        provider,
      });
      const total = money(payees.reduce((s, p) => s + p.amount, 0));
      res.json({ payees, total, dueDate, claimFrom, claimTo, payeeType, branch, provider });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/claimable/change-source", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const result = await changeClaimableSource({
        tenantId: ctx.tenantId,
        employeeId: Number(req.body.employeeId),
        claimFrom: String(req.body.claimFrom),
        claimTo: String(req.body.claimTo),
        payeeType: req.body.payeeType === "Self-employed" ? "Self-employed" : "PAYE",
        toSource: String(req.body.toSource || "").trim(),
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const created = await createBills({
        tenantId: ctx.tenantId,
        employeeIds: Array.isArray(req.body.employeeIds) ? req.body.employeeIds.map(Number) : [],
        claimFrom: String(req.body.claimFrom),
        claimTo: String(req.body.claimTo),
        dueDate: String(req.body.dueDate),
        payeeType: req.body.payeeType === "Self-employed" ? "Self-employed" : "PAYE",
        branch: req.body.branch === "MAIN" || req.body.branch === "Contractor" ? req.body.branch : "ALL",
        provider: req.body.provider || "ALL",
        userId: ctx.user.id,
      });
      res.json({ bills: created });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/payroll-control/bills/:id", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const result = await deleteBill({ tenantId: ctx.tenantId, billId: paramId(req.params.id) });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills/delete", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const billIds = Array.isArray(req.body.billIds) ? req.body.billIds.map(Number) : [];
      const results = await deleteBills({ tenantId: ctx.tenantId, billIds });
      res.json({ deleted: results.length, results });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/queue", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const paid = String(req.query.paid || "false") === "true";
      const search = String(req.query.search || "").trim().toLowerCase();
      const dueFrom = req.query.dueFrom ? String(req.query.dueFrom) : "";
      const dueTo = req.query.dueTo ? String(req.query.dueTo) : "";
      const payeeType = String(req.query.payeeType || "ALL");
      const branch = String(req.query.branch || "ALL");
      const remarks = String(req.query.remarks || "ALL");
      const sort = String(req.query.sort || "bill_date");
      const dir = String(req.query.dir || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
      const empLevel = req.query.empLevel != null && req.query.empLevel !== "" ? Number(req.query.empLevel) : null;
      const queMark = String(req.query.queMark || "ALL");

      const params: any[] = [ctx.tenantId, paid ? "PAID" : "UNPAID"];
      const where = [`b.tenant_id = $1`, `b.status = $2`];
      if (dueFrom) {
        params.push(dueFrom);
        where.push(`b.due_date >= $${params.length}`);
      }
      if (dueTo) {
        params.push(dueTo);
        where.push(`b.due_date <= $${params.length}`);
      }
      if (payeeType !== "ALL") {
        params.push(payeeType);
        where.push(`b.payee_type = $${params.length}`);
      }
      if (branch === "Employee") where.push(`b.branch_type = 'MAIN'`);
      if (branch === "Contractor") where.push(`b.branch_type = 'Contractor'`);
      if (remarks === "1st4 PAYE") where.push(`(b.remarks ILIKE '%1st4%' OR b.payroll_provider = 'first4_paye')`);
      if (remarks === "GFM PAYE") where.push(`(b.remarks ILIKE '%GFM%' OR b.payroll_provider = 'gfm_paye')`);
      if (empLevel != null && !Number.isNaN(empLevel)) {
        params.push(empLevel);
        where.push(`b.emp_level = $${params.length}`);
      }
      const sortCol = sort === "amount" ? "b.bill_amount" : sort === "remarks" ? "b.remarks" : "b.bill_date";
      const { rows } = await pool.query(
        `SELECT b.*, u.first_name, u.last_name, e.employee_number, e.portal_email, u.email, e.phone
         FROM payroll_bills b
         JOIN employees e ON e.id = b.employee_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE ${where.join(" AND ")}
         ORDER BY ${sortCol} ${dir}, b.id ${dir}`,
        params,
      );
      let list = rows.map((r: any, i: number) => ({
        sno: i + 1,
        id: r.id,
        billNumber: r.bill_number,
        billDate: r.bill_date,
        dueDate: r.due_date,
        empLevel: r.emp_level,
        branch: r.branch_type,
        particulars: r.particulars,
        accountTitle: r.account_title,
        accountNumber: r.account_number,
        sortCode: r.sort_code,
        status: r.status,
        billAmount: num(r.bill_amount),
        paidAmount: num(r.paid_amount),
        balance: num(r.balance),
        remarks: r.remarks,
        niNumber: r.ni_number,
        payrollProvider: r.payroll_provider,
        terms: r.terms,
        postDate: r.post_date,
        bankName: r.bank_name,
        remittance: !!r.remittance,
        payeeName: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        email: r.email || r.portal_email,
        phone: r.phone,
        employeeId: r.employee_id,
      }));
      if (search) {
        list = list.filter((r) =>
          r.payeeName.toLowerCase().includes(search)
          || String(r.billNumber).toLowerCase().includes(search)
          || String(r.accountNumber || "").includes(search),
        );
      }
      if (queMark === "checked") list = list.filter((r) => r.remittance);
      if (queMark === "unchecked") list = list.filter((r) => !r.remittance);
      res.json({ bills: list });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/queue.csv", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const paid = String(req.query.paid || "false") === "true";
      const { rows } = await pool.query(
        `SELECT b.*, u.first_name, u.last_name FROM payroll_bills b
         JOIN employees e ON e.id = b.employee_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE b.tenant_id = $1 AND b.status = $2
         ORDER BY b.bill_date, b.id`,
        [ctx.tenantId, paid ? "PAID" : "UNPAID"],
      );
      const header = ["Bill ID","Bill Date","Payee","Account","Sort code","Status","Bill amount","Paid","Balance","Remarks","Provider"];
      const lines = [header.join(",")];
      for (const r of rows) {
        const cells = [
          r.bill_number, r.bill_date, `${r.first_name || ""} ${r.last_name || ""}`.trim(),
          r.account_number, r.sort_code, r.status, r.bill_amount, r.paid_amount, r.balance,
          `"${String(r.remarks || "").replace(/"/g, '""')}"`, r.payroll_provider,
        ];
        lines.push(cells.join(","));
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="payroll-queue.csv"`);
      res.send(lines.join("\n"));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/queue/remarks", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const ids: number[] = Array.isArray(req.body.billIds) ? req.body.billIds.map(Number) : [];
      const remarks = String(req.body.remarks || "");
      if (!ids.length) return res.status(400).json({ message: "Tick rows first" });
      await pool.query(
        `UPDATE payroll_bills SET remarks = $2, updated_at = NOW() WHERE tenant_id = $1 AND id = ANY($3::int[])`,
        [ctx.tenantId, remarks, ids],
      );
      res.json({ updated: ids.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/bills/:id/review", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const data = await loadBillReview(ctx.tenantId, paramId(req.params.id));
      res.json(data);
    } catch (err: any) {
      res.status(404).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/mark-paid", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const items: any[] = Array.isArray(req.body.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ message: "Tick bills first" });
      const results = [];
      for (const item of items) {
        const result = await markBillPaid({
          tenantId: ctx.tenantId,
          billId: Number(item.billId),
          paidAmount: num(item.paidAmount),
          postDate: item.postDate || null,
          bankName: item.bankName || null,
          remittance: !!item.remittance,
          remarks: item.remarks ?? null,
          userId: ctx.user.id,
        });
        if (item.remittance && result.paidNow > 0) {
          try {
            await sendRemittance(ctx.tenantId, result.bill, ctx.user.id);
          } catch (e: any) {
            results.push({ billId: item.billId, ...result, remittanceError: e.message });
            continue;
          }
        }
        results.push({ billId: item.billId, ...result });
      }
      res.json({ results });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills/:id/remittance", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
        paramId(req.params.id), ctx.tenantId,
      ]);
      if (!bill.rows[0]) return res.status(404).json({ message: "Bill not found" });
      const result = await sendRemittance(ctx.tenantId, bill.rows[0], ctx.user.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/remittance", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const billIds: number[] = Array.isArray(req.body.billIds) ? req.body.billIds.map(Number) : [];
      if (!billIds.length) return res.status(400).json({ message: "Tick bills first" });
      const results: any[] = [];
      for (const id of billIds) {
        try {
          const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
            id, ctx.tenantId,
          ]);
          if (!bill.rows[0]) {
            results.push({ billId: id, ok: false, error: "Bill not found" });
            continue;
          }
          const sent = await sendRemittance(ctx.tenantId, bill.rows[0], ctx.user.id);
          results.push({ billId: id, ...sent });
        } catch (e: any) {
          results.push({ billId: id, ok: false, error: e.message });
        }
      }
      const failed = results.filter((r) => !r.ok);
      res.json({ sent: results.length - failed.length, failed: failed.length, results });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/bills/:id/remittance", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const billQ = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
        paramId(req.params.id), ctx.tenantId,
      ]);
      const bill = billQ.rows[0];
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      const contact = await officerContact(bill.employee_id);
      const tenant = await storage.getTenant(ctx.tenantId);
      const amount = num(bill.paid_amount) > 0 ? num(bill.paid_amount) : num(bill.bill_amount);
      const pdf = await generateRemittanceAdvicePdf({
        companyName: tenant?.name || "Gardeo",
        billNumber: bill.bill_number,
        officerName: contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Officer",
        amount,
        postDate: String(bill.post_date || bill.bill_date || "").slice(0, 10),
        bankName: bill.bank_name,
        accountTitle: bill.account_title,
        accountNumber: bill.account_number,
        sortCode: bill.sort_code,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="remittance-${bill.bill_number}.pdf"`);
      res.send(pdf);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills/:id/sms", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
        paramId(req.params.id), ctx.tenantId,
      ]);
      if (!bill.rows[0]) return res.status(404).json({ message: "Bill not found" });
      const contact = await officerContact(bill.rows[0].employee_id);
      const phone = contact?.phone || contact?.user_phone;
      const body = `Payment notice: bill ${bill.rows[0].bill_number} for ${gbp(bill.rows[0].bill_amount)}. Status ${bill.rows[0].status}.`;
      const sms = phone
        ? await sendSMS(phone, body)
        : { success: false, error: "No phone number on file" };
      await pool.query(
        `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, body, error_message, created_by)
         VALUES ($1,$2,'sms',$3,$4,$5,$6)`,
        [ctx.tenantId, bill.rows[0].id, sms.success ? "sent" : "failed", body, sms.error || null, ctx.user.id],
      );
      if (!sms.success) return res.status(400).json({ message: sms.error || "SMS failed" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills/:id/email", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
        paramId(req.params.id), ctx.tenantId,
      ]);
      if (!bill.rows[0]) return res.status(404).json({ message: "Bill not found" });
      const contact = await officerContact(bill.rows[0].employee_id);
      const to = contact?.email || contact?.portal_email;
      if (!to) return res.status(400).json({ message: "No email address" });
      const subject = `Payment notice ${bill.rows[0].bill_number}`;
      const html = `<p>Bill ${bill.rows[0].bill_number} amount ${gbp(bill.rows[0].bill_amount)}. Status ${bill.rows[0].status}.</p>`;
      const sent = await sendViaTenantEmailSettings({ tenantId: ctx.tenantId, to, subject, html });
      await pool.query(
        `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, subject, body, error_message, created_by)
         VALUES ($1,$2,'email',$3,$4,$5,$6,$7)`,
        [ctx.tenantId, bill.rows[0].id, sent.ok ? "sent" : "failed", subject, html, sent.error || null, ctx.user.id],
      );
      if (!sent.ok) return res.status(400).json({ message: sent.error || "Email failed" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/send-email", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const ids: number[] = Array.isArray(req.body.billIds) ? req.body.billIds.map(Number) : [];
      const subject = String(req.body.subject || "Payroll notice");
      const body = String(req.body.body || "");
      if (!ids.length) return res.status(400).json({ message: "Tick rows first" });
      const results = [];
      for (const id of ids) {
        const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [id, ctx.tenantId]);
        if (!bill.rows[0]) continue;
        const contact = await officerContact(bill.rows[0].employee_id);
        const to = contact?.email || contact?.portal_email;
        if (!to) {
          results.push({ billId: id, ok: false, error: "No email address" });
          continue;
        }
        const sent = await sendViaTenantEmailSettings({
          tenantId: ctx.tenantId,
          to,
          subject,
          html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        });
        await pool.query(
          `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, subject, body, error_message, created_by)
           VALUES ($1,$2,'email',$3,$4,$5,$6,$7)`,
          [ctx.tenantId, id, sent.ok ? "sent" : "failed", subject, body, sent.error || null, ctx.user.id],
        );
        results.push({ billId: id, ok: sent.ok, error: sent.error });
      }
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payroll-control/bills/:id/bank", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      if (!req.body.confirm) return res.status(400).json({ message: "Confirm writing bank details to the officer master" });
      const bill = await pool.query(`SELECT * FROM payroll_bills WHERE id = $1 AND tenant_id = $2`, [
        paramId(req.params.id), ctx.tenantId,
      ]);
      if (!bill.rows[0]) return res.status(404).json({ message: "Bill not found" });
      const { accountTitle, accountNumber, sortCode, bankName } = req.body;
      await pool.query(
        `UPDATE payroll_bills SET account_title = COALESCE($2, account_title),
           account_number = COALESCE($3, account_number), sort_code = COALESCE($4, sort_code),
           bank_name = COALESCE($5, bank_name), updated_at = NOW() WHERE id = $1`,
        [bill.rows[0].id, accountTitle, accountNumber, sortCode, bankName],
      );
      const purpose = bill.rows[0].payee_type === "Self-employed" ? "self" : "payee";
      const existing = await storage.getBankDetailsByPurpose(bill.rows[0].employee_id, purpose)
        ?? await storage.getBankDetailsByPurpose(bill.rows[0].employee_id, "default");
      const nextAccountName = accountTitle ?? existing?.accountName;
      const nextAccountNumber = accountNumber ?? existing?.accountNumber;
      const nextSortCode = sortCode ?? existing?.sortCode;
      const nextBankName = bankName ?? existing?.bankName;
      if (nextAccountName && nextAccountNumber && nextSortCode && nextBankName) {
        await storage.upsertBankDetailsByPurpose(bill.rows[0].employee_id, purpose, {
          accountName: nextAccountName,
          accountNumber: nextAccountNumber,
          sortCode: nextSortCode,
          bankName: nextBankName,
          buildingSocietyRef: existing?.buildingSocietyRef ?? null,
        });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-control/bills/:id/payslip", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const latest = await pool.query(
        `SELECT * FROM payroll_payslips WHERE bill_id = $1 AND tenant_id = $2 ORDER BY id DESC LIMIT 1`,
        [paramId(req.params.id), ctx.tenantId],
      );
      const payload = await payslipPayload(ctx.tenantId, paramId(req.params.id));
      const pdf = await generatePayslipPdf(payload);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="payslip-${payload.billNumber}.pdf"`);
      res.send(pdf);
      void latest;
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/bills/:id/payslip", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const billId = paramId(req.params.id);
      const payload = await payslipPayload(ctx.tenantId, billId);
      const pdf = await generatePayslipPdf(payload);
      const fileUrl = await storePdf("payslips", pdf);
      await pool.query(
        `INSERT INTO payroll_payslips (tenant_id, bill_id, employee_id, file_url, generated_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [ctx.tenantId, billId, payload.employeeId, fileUrl, ctx.user.id],
      );
      if (req.body.email) {
        if (!payload.email) return res.status(400).json({ message: "No email address" });
        const sent = await sendViaTenantEmailSettings({
          tenantId: ctx.tenantId,
          to: payload.email,
          subject: `Payslip ${payload.billNumber}`,
          html: `<p>Your payslip for bill ${payload.billNumber} is ready.</p>`,
        });
        await pool.query(
          `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, subject, error_message, created_by)
           VALUES ($1,$2,'payslip',$3,$4,$5,$6)`,
          [ctx.tenantId, billId, sent.ok ? "sent" : "failed", `Payslip ${payload.billNumber}`, sent.error || null, ctx.user.id],
        );
        if (!sent.ok) return res.status(400).json({ message: sent.error || "Email failed" });
      }
      res.json({ ok: true, fileUrl });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/payroll-control/payslips/bulk", requireRole(...MONEY_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      if (!financeOnly(ctx.user, res)) return;
      const ids: number[] = Array.isArray(req.body.billIds) ? req.body.billIds.map(Number) : [];
      const email = !!req.body.email;
      const results = [];
      for (const id of ids) {
        try {
          const payload = await payslipPayload(ctx.tenantId, id);
          const pdf = await generatePayslipPdf(payload);
          const fileUrl = await storePdf("payslips", pdf);
          await pool.query(
            `INSERT INTO payroll_payslips (tenant_id, bill_id, employee_id, file_url, generated_by)
             VALUES ($1,$2,$3,$4,$5)`,
            [ctx.tenantId, id, payload.employeeId, fileUrl, ctx.user.id],
          );
          if (email && payload.email) {
            await sendViaTenantEmailSettings({
              tenantId: ctx.tenantId,
              to: payload.email,
              subject: `Payslip ${payload.billNumber}`,
              html: `<p>Your payslip for bill ${payload.billNumber} is ready.</p>`,
            });
          }
          results.push({ billId: id, ok: true, fileUrl });
        } catch (e: any) {
          results.push({ billId: id, ok: false, error: e.message });
        }
      }
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

function gbp(v: unknown): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num(v));
}
