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
  { value: "low_rates", label: "Low rates (9–11.5)", niCap: 0, restRate: null, mode: "low_rates" as const },
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

export function canControlApprove(role: string | undefined | null): boolean {
  return role === "controller" || role === "super_admin";
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

export function ruleLabel(value: string): string {
  return PAYMENT_RULES.find((r) => r.value === value)?.label || value;
}

export function sourceLabel(value: string): string {
  return PAYROLL_SOURCES.find((s) => s.value === value)?.label || value;
}

export function getRuleDef(value: string) {
  return PAYMENT_RULES.find((r) => r.value === value) || PAYMENT_RULES[0];
}

export function payeBucketForSource(source: string): WageBucket {
  return source === "gfm_paye" ? "gfm_paye" : "first4_paye";
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
