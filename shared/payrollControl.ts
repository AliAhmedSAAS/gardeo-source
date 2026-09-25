export const PAYE_RATE = 12.71;

export const PAYROLL_SOURCES = [
  { value: "first4_paye", label: "1st4 PAYE" },
  { value: "gfm_paye", label: "GFM PAYE" },
  { value: "self_employed", label: "Self-employed" },
] as const;

export type PayrollSource = (typeof PAYROLL_SOURCES)[number]["value"];

export const PAYMENT_RULES = [
  { value: "full_paye", label: "Full PAYE", niCap: 0, restRate: null as number | null, mode: "full_paye" as const },
  { value: "full_paye_10_9", label: "Full PAYE 10.9", niCap: 0, restRate: 10.9, mode: "full_paye_rate" as const },
  { value: "full_self", label: "Full Self-Employed", niCap: 0, restRate: null, mode: "full_self" as const },
  { value: "full_self_9", label: "Full Self employee 9", niCap: 0, restRate: 9, mode: "full_self_rate" as const },
  { value: "full_self_9_5", label: "Self employee 9.5", niCap: 0, restRate: 9.5, mode: "full_self_rate" as const },
  { value: "full_self_10", label: "Self employee 10", niCap: 0, restRate: 10, mode: "full_self_rate" as const },
  { value: "full_self_10_5", label: "Self employee 10.5", niCap: 0, restRate: 10.5, mode: "full_self_rate" as const },
  { value: "full_self_11", label: "Self employee 11", niCap: 0, restRate: 11, mode: "full_self_rate" as const },
  { value: "full_self_11_5", label: "Self employee 11.5", niCap: 0, restRate: 11.5, mode: "full_self_rate" as const },
  { value: "ni_80", label: "80 hrs on NI", niCap: 80, restRate: null, mode: "ni_rest" as const },
  { value: "ni_80_rest_9", label: "80 hrs on NI Rest on 9", niCap: 80, restRate: 9, mode: "ni_rest" as const },
  { value: "ni_80_rest_9_5", label: "80 hrs on NI Rest on 9.5", niCap: 80, restRate: 9.5, mode: "ni_rest" as const },
  { value: "ni_80_rest_10", label: "80 hrs on NI Rest on 10", niCap: 80, restRate: 10, mode: "ni_rest" as const },
  { value: "ni_80_rest_10_42", label: "80 hrs on NI Rest on 10.42", niCap: 80, restRate: 10.42, mode: "ni_rest" as const },
  { value: "ni_80_rest_10_50", label: "80 hrs on NI Rest on 10.50", niCap: 80, restRate: 10.5, mode: "ni_rest" as const },
  { value: "ni_80_rest_11", label: "80 hrs on NI Rest on 11", niCap: 80, restRate: 11, mode: "ni_rest" as const },
  { value: "ni_80_rest_11_50", label: "80 hrs on NI Rest on 11.50", niCap: 80, restRate: 11.5, mode: "ni_rest" as const },
  { value: "ni_90_rest_10_50", label: "90 hrs on NI Rest on 10.50", niCap: 90, restRate: 10.5, mode: "ni_rest" as const },
  { value: "ni_100_rest_10_50", label: "100 hrs on NI Rest on 10.50", niCap: 100, restRate: 10.5, mode: "ni_rest" as const },
] as const;

export type PaymentRule = (typeof PAYMENT_RULES)[number]["value"];

export const NI_USED_STEPS = [0, 10, 20, 30, 40, 50, 60, 70] as const;

export const WAGE_BUCKETS = ["first4_paye", "gfm_paye", "self"] as const;
export type WageBucket = (typeof WAGE_BUCKETS)[number];

export const HR_STATUSES = ["hold", "approved"] as const;
export type HrStatus = (typeof HR_STATUSES)[number];

export const APPROVAL_COLUMNS = ["control", "hr", "accounts"] as const;
export type ApprovalColumn = (typeof APPROVAL_COLUMNS)[number];

export const PAYROLL_CONTROL_VIEW_ROLES = [
  "super_admin",
  "tenant_admin",
  "ceo",
  "admin",
  "controller",
  "hr_manager",
  "accountant",
  "payroll_manager",
] as const;

export const FINANCE_ROLES = ["super_admin", "accountant", "payroll_manager"] as const;
export const ADMIN_ROLES = ["super_admin", "tenant_admin", "ceo", "admin"] as const;

export function isFinanceRole(role: string | undefined | null): boolean {
  return !!role && (FINANCE_ROLES as readonly string[]).includes(role);
}

export function isAdminRole(role: string | undefined | null): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Apply Rules + money tagging — finance or tenant admins. */
export function canApplyRules(role: string | undefined | null): boolean {
  return isFinanceRole(role) || isAdminRole(role);
}

export function canControlApprove(role: string | undefined | null): boolean {
  // Controllers own this column; tenant admins can also complete the 3-way flow.
  return role === "controller" || isAdminRole(role);
}

export function canHrApprove(role: string | undefined | null): boolean {
  return role === "hr_manager" || isAdminRole(role) || isFinanceRole(role);
}

export function canAccountsApprove(role: string | undefined | null): boolean {
  return isAdminRole(role) || isFinanceRole(role);
}

export function canHrHold(role: string | undefined | null): boolean {
  return role === "hr_manager" || role === "super_admin";
}

export function canControllerRemarks(role: string | undefined | null): boolean {
  return role === "controller" || role === "super_admin";
}

export function canAccountsRemarks(role: string | undefined | null): boolean {
  return isAdminRole(role) || isFinanceRole(role);
}

export function ruleRateText(value: string): string {
  const r = PAYMENT_RULES.find((x) => x.value === value);
  if (!r) return "";
  if (r.mode === "full_paye") return `£${PAYE_RATE}`;
  if (r.mode === "full_paye_rate") return `£${r.restRate}`;
  if (r.mode === "full_self") return "officer rate";
  if (r.mode === "full_self_rate") return `£${r.restRate}`;
  if (r.mode === "ni_rest") {
    if (r.restRate == null) return `NI £${PAYE_RATE} / rest officer rate`;
    return `NI £${PAYE_RATE} / rest £${r.restRate}`;
  }
  return "";
}

export function ruleLabel(value: string): string {
  const r = PAYMENT_RULES.find((x) => x.value === value);
  if (!r) return value;
  const rates = ruleRateText(value);
  return rates ? `${r.label} (${rates})` : r.label;
}

export function sourceLabel(value: string): string {
  return PAYROLL_SOURCES.find((s) => s.value === value)?.label || value;
}

export function getRuleDef(value: string) {
  return PAYMENT_RULES.find((r) => r.value === value) || PAYMENT_RULES[0];
}

export function payeBucketForSource(source: string, wageBucketHint?: string | null): WageBucket {
  if (wageBucketHint === "gfm_paye" || wageBucketHint === "first4_paye") return wageBucketHint;
  if (source === "gfm_paye") return "gfm_paye";
  return "first4_paye";
}

export function slugifyPayrollSource(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "source";
}

export function money2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Self-employed lines: book rate below £12.71 stays at PAYE rate, with a deduction for the gap. */
export function selfShiftPayDisplay(params: {
  hours: number;
  rate: number;
  wages: number;
  bucket?: string | null;
}): { rate: number; wages: number; deduction: number; net: number } {
  const hours = Number(params.hours) || 0;
  const storedRate = Number(params.rate) || 0;
  const net = Number(params.wages) || 0;
  if (params.bucket !== "self") {
    return { rate: storedRate, wages: net, deduction: 0, net };
  }
  const impliedBook = hours > 0 ? money2(net / hours) : storedRate;
  const bookRate = impliedBook > 0 ? impliedBook : storedRate;
  if (bookRate + 0.001 >= PAYE_RATE) {
    return { rate: storedRate || PAYE_RATE, wages: net, deduction: 0, net };
  }
  const gross = money2(hours * PAYE_RATE);
  return {
    rate: PAYE_RATE,
    wages: gross,
    deduction: money2(gross - net),
    net,
  };
}

export function monthStart(month: string): string {
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  return String(month).slice(0, 10);
}

export function monthEnd(month: string): string {
  const start = new Date(`${monthStart(month)}T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentPayrollMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
