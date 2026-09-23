import type { Express, Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";
import { pool } from "./db";
import { sendSMS } from "./twilio-service";
import { sendViaTenantEmailSettings } from "./tenant-email-settings";
import {
  PAYROLL_CONTROL_VIEW_ROLES,
  FINANCE_ROLES,
  currentPayrollMonth,
  monthStart,
  monthEnd,
  isFinanceRole,
  canControlApprove,
  canHrApprove,
  canAccountsApprove,
  canHrHold,
  canControllerRemarks,
  canAccountsRemarks,
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
  num,
  money,
} from "./payroll-control";
import { generatePayslipPdf, generateRemittanceAdvicePdf } from "./payroll-control-pdf";

type RequireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;

function paramId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(String(raw || ""), 10);
}

const VIEW_ROLES = [...PAYROLL_CONTROL_VIEW_ROLES];
const MONEY_ROLES = [...FINANCE_ROLES];

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
  if (isFinanceRole(user.role)) return true;
  res.status(403).json({ message: "Finance only" });
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
  const pdf = await generateRemittanceAdvicePdf({
    companyName: tenant?.name || "Gardeo",
    billNumber: bill.bill_number,
    officerName: contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Officer",
    amount: num(bill.paid_amount) || num(bill.bill_amount),
    postDate: String(bill.post_date || "").slice(0, 10),
    bankName: bill.bank_name,
    accountTitle: bill.account_title,
    accountNumber: bill.account_number,
    sortCode: bill.sort_code,
  });
  const to = contact?.email || contact?.portal_email;
  if (!to) throw new Error("No email address for remittance");
  const sent = await sendViaTenantEmailSettings({
    tenantId,
    to,
    subject: `Remittance advice ${bill.bill_number}`,
    html: `<p>Please find remittance advice for bill ${bill.bill_number}.</p>`,
  });
  await pool.query(
    `INSERT INTO payroll_control_comms (tenant_id, bill_id, channel, status, subject, body, error_message, created_by)
     VALUES ($1,$2,'remittance',$3,$4,$5,$6,$7)`,
    [tenantId, bill.id, sent.ok ? "sent" : "failed", `Remittance ${bill.bill_number}`, null, sent.error || null, userId],
  );
  void pdf;
  if (!sent.ok) throw new Error(sent.error || "Remittance email failed");
}

export function registerPayrollControlRoutes(app: Express, requireRole: RequireRole) {
  app.get("/api/payroll-control/summary", requireRole(...VIEW_ROLES), async (req, res) => {
    try {
      const ctx = await requireCustomPayroll(req, res);
      if (!ctx) return;
      const month = String(req.query.month || currentPayrollMonth());
      const search = String(req.query.search || "").trim().toLowerCase();
      const rule = String(req.query.rule || "ALL");
      const source = String(req.query.source || "ALL");
      const from = monthStart(month);
      const to = monthEnd(month);

      const { rows } = await pool.query(
        `SELECT e.id AS employee_id, e.employee_number, e.external_id, e.employment_type, e.officer_step,
                e.national_insurance, e.supplier_id, e.hourly_rate,
                u.first_name, u.last_name,
                s.name AS agent_name,
                b.account_name, b.account_number, b.sort_code, b.bank_name,
                m.id AS month_id, m.rules_of_payment, m.payroll_source, m.ni_used, m.hr_status,
                m.remarks, m.accounts_remarks, m.first4_hours, m.first4_wages, m.first4_paid,
                m.gfm_hours, m.gfm_wages, m.gfm_paid, m.self_hours, m.self_wages, m.self_paid,
                r.id AS request_id, r.from_rule, r.from_source, r.to_rule, r.to_source,
                r.control_status, r.hr_status AS req_hr_status, r.accounts_status
         FROM employees e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN bank_details b ON b.employee_id = e.id
         LEFT JOIN payroll_control_months m
           ON m.employee_id = e.id AND m.tenant_id = e.tenant_id AND m.period_month = $2
         LEFT JOIN payroll_rule_change_requests r
           ON r.month_row_id = m.id AND r.resolved_at IS NULL
         WHERE e.tenant_id = $1 AND COALESCE(e.is_merged, false) = false
           AND (
             EXISTS (
               SELECT 1 FROM shifts sh
               WHERE sh.employee_id = e.id AND sh.tenant_id = e.tenant_id
                 AND sh.date >= $2 AND sh.date <= $3
                 AND sh.status IN ('verified','completed')
             )
             OR m.id IS NOT NULL
           )`,
        [ctx.tenantId, from, to],
      );

      let officers = rows.map((r: any) => ({
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
        niUsed: Number(r.ni_used || 0),
        first4Hours: num(r.first4_hours),
        first4Wages: num(r.first4_wages),
        first4Paid: !!r.first4_paid,
        gfmHours: num(r.gfm_hours),
        gfmWages: num(r.gfm_wages),
        gfmPaid: !!r.gfm_paid,
        selfHours: num(r.self_hours),
        selfWages: num(r.self_wages),
        selfPaid: !!r.self_paid,
        remarks: r.remarks,
        accountsRemarks: r.accounts_remarks,
        request: r.request_id ? {
          id: r.request_id,
          fromRule: r.from_rule,
          fromSource: r.from_source,
          toRule: r.to_rule,
          toSource: r.to_source,
          controlStatus: r.control_status,
          hrStatus: r.req_hr_status,
          accountsStatus: r.accounts_status,
        } : null,
      }));

      if (search) {
        officers = officers.filter((o) =>
          o.name.toLowerCase().includes(search) || o.wid.toLowerCase().includes(search),
        );
      }
      if (rule !== "ALL") officers = officers.filter((o) => o.rulesOfPayment === rule);
      if (source !== "ALL") officers = officers.filter((o) => o.payrollSource === source);

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
      const month = await pool.query(
        `SELECT * FROM payroll_control_months WHERE id = $1 AND tenant_id = $2`,
        [monthId, ctx.tenantId],
      );
      if (!month.rows[0]) return res.status(404).json({ message: "Not found" });
      const row = month.rows[0];
      const from = String(row.period_month).slice(0, 10);
      const to = monthEnd(from.slice(0, 7));
      const { rows } = await pool.query(
        `SELECT s.id, s.date, s.start_time, s.end_time, s.title, s.status, s.break_minutes,
                st.name AS site_name, l.hours, l.rate, l.wages, l.bucket, l.billed
         FROM shifts s
         LEFT JOIN sites st ON st.id = s.site_id
         LEFT JOIN payroll_applied_lines l ON l.shift_id = s.id AND l.month_row_id = $4
         WHERE s.tenant_id = $1 AND s.employee_id = $2
           AND s.date >= $3 AND s.date <= $5
           AND s.status IN ('verified','completed')
         ORDER BY s.date, s.start_time`,
        [ctx.tenantId, row.employee_id, from, monthId, to],
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
      const { monthId, toRule, toSource } = req.body;
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
      if (column === "control" && !canControlApprove(ctx.user.role)) return res.status(403).json({ message: "Controller only" });
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
      const existing = await storage.getBankDetails(bill.rows[0].employee_id);
      if (existing) {
        await storage.updateBankDetails(existing.id, {
          accountName: accountTitle ?? existing.accountName,
          accountNumber: accountNumber ?? existing.accountNumber,
          sortCode: sortCode ?? existing.sortCode,
          bankName: bankName ?? existing.bankName,
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
