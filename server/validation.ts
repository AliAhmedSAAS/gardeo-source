import { z } from "zod";
import type { Response } from "express";

/** Returns an error suffix (e.g. "must be a number") or null when the value is acceptable. */
type Check = (value: unknown) => string | null;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function field(label: string, check: Check, required = false) {
  return z.unknown().superRefine((value, ctx) => {
    if (isBlank(value)) {
      if (required) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required` });
      return;
    }
    const problem = check(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} ${problem}` });
  });
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

const text = (max: number): Check => (v) =>
  typeof v !== "string" ? "must be text" : v.trim().length > max ? `must be at most ${max} characters` : null;

const email: Check = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : "is not a valid email address";

const phone: Check = (v) => {
  if (typeof v !== "string" || !/^\+?[\d\s()-]+$/.test(v.trim())) return "is not a valid phone number";
  const digits = v.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? null : "is not a valid phone number";
};

const ukPostcode: Check = (v) =>
  typeof v === "string" && /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(v.trim()) ? null : "is not a valid UK postcode";

const isoDate: Check = (v) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)) ? null : "is not a valid date (YYYY-MM-DD)";

const clockTime: Check = (v) =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? null : "must be a time in HH:MM format";

const money = (max: number): Check => (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return "must be a number";
  if (n < 0) return "must not be negative";
  return n > max ? `must not exceed ${max}` : null;
};

const numberRange = (min: number, max: number): Check => (v) => {
  const n = toNumber(v);
  return Number.isFinite(n) && n >= min && n <= max ? null : `must be a number between ${min} and ${max}`;
};

const integerRange = (min: number, max: number): Check => (v) => {
  const n = toNumber(v);
  return Number.isInteger(n) && n >= min && n <= max ? null : `must be a whole number between ${min} and ${max}`;
};

const recordId: Check = (v) => (Number.isInteger(toNumber(v)) && toNumber(v) > 0 ? null : "is not a valid id");

const nationalInsurance: Check = (v) =>
  typeof v === "string" && /^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/i.test(v.replace(/\s/g, ""))
    ? null
    : "is not a valid National Insurance number (e.g. QQ123456C)";

const siaLicence: Check = (v) =>
  typeof v === "string" && /^\d{16}$/.test(v.replace(/[\s-]/g, "")) ? null : "must be 16 digits";

const dateOfBirth: Check = (v) => {
  if (isoDate(v)) return isoDate(v);
  const ageYears = (Date.now() - Date.parse(String(v))) / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears >= 16 && ageYears <= 100 ? null : "must give an age between 16 and 100";
};

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

type Rule = (body: Record<string, unknown>) => { path: string; message: string } | null;

const dateOrder = (from: string, to: string, label: string): Rule => (body) => {
  const a = body[from];
  const b = body[to];
  if (isBlank(a) || isBlank(b) || isoDate(a) || isoDate(b)) return null;
  return Date.parse(String(b)) < Date.parse(String(a)) ? { path: to, message: `${label} cannot be before the start date` } : null;
};

const shiftTimes: Rule = (body) => {
  const { startTime, endTime, breakMinutes } = body;
  if (isBlank(startTime) || isBlank(endTime) || clockTime(startTime) || clockTime(endTime)) return null;
  const start = minutesOf(String(startTime));
  let end = minutesOf(String(endTime));
  if (end === start) return { path: "endTime", message: "Start and end time cannot be the same" };
  if (end < start) end += 24 * 60;
  const breakValue = toNumber(breakMinutes);
  if (!isBlank(breakMinutes) && Number.isFinite(breakValue) && breakValue >= end - start) {
    return { path: "breakMinutes", message: "Break must be shorter than the shift" };
  }
  return null;
};

function withRules(schema: z.AnyZodObject, rules: Rule[]) {
  return schema.passthrough().superRefine((body, ctx) => {
    for (const rule of rules) {
      const issue = rule(body as Record<string, unknown>);
      if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
    }
  });
}

/** Builds a create schema (required fields enforced) and an update schema (only supplied fields checked). */
function bodySchemas<T extends z.ZodRawShape>(shape: T, rules: Rule[] = [], updateOverrides: z.ZodRawShape = {}) {
  const base = z.object(shape);
  return {
    create: withRules(base, rules),
    update: withRules(base.extend(updateOverrides).partial(), rules),
  };
}

export const clientSchemas = bodySchemas({
  companyName: field("Company name", text(200), true),
  companyRegNumber: field("Company registration number", text(20)),
  contactName: field("Contact name", text(200)),
  contactEmail: field("Contact email", email),
  contactPhone: field("Contact phone", phone),
  billingEmail: field("Billing email", email),
  address: field("Address", text(500)),
  postcode: field("Postcode", ukPostcode),
  contractStartDate: field("Contract start date", isoDate),
  contractEndDate: field("Contract end date", isoDate),
}, [dateOrder("contractStartDate", "contractEndDate", "Contract end date")]);

export const siteSchemas = bodySchemas({
  name: field("Site name", text(200), true),
  address: field("Address", text(500), true),
  postcode: field("Postcode", ukPostcode),
  latitude: field("Latitude", numberRange(-90, 90)),
  longitude: field("Longitude", numberRange(-180, 180)),
  clientId: field("Client", recordId),
  clientEmail: field("Client email", email),
  clientPhone: field("Client phone", phone),
  managerEmail: field("Manager email", email),
  bookOnEmail: field("Book-on email", email),
  breakDeductionMinutes: field("Break deduction", integerRange(0, 240)),
  geofenceRadiusMetres: field("Geofence radius", integerRange(0, 100000)),
});

export const shiftSchemas = bodySchemas({
  title: field("Title", text(200), true),
  date: field("Date", isoDate, true),
  startTime: field("Start time", clockTime, true),
  endTime: field("End time", clockTime, true),
  siteId: field("Site", recordId, true),
  employeeId: field("Employee", recordId),
  supplierId: field("Supplier", recordId),
  breakMinutes: field("Break", integerRange(0, 720)),
  payRate: field("Pay rate", money(1000)),
  chargeRate: field("Charge rate", money(1000)),
  holidayHours: field("Holiday hours", numberRange(0, 24)),
  travelAllowance: field("Travel allowance", money(1000)),
}, [shiftTimes], { siteId: field("Site", recordId) });

export const supplierSchemas = bodySchemas({
  companyName: field("Company name", text(200), true),
  email: field("Email", email),
  phone: field("Phone", phone),
  financeContactEmail: field("Finance contact email", email),
  postcode: field("Postcode", ukPostcode),
  registeredOfficePostcode: field("Registered office postcode", ukPostcode),
  tradingPostcode: field("Trading postcode", ukPostcode),
});

export const clientRateCardSchemas = bodySchemas({
  hourlyChargeRate: field("Hourly charge rate", money(1000), true),
  effectiveFrom: field("Effective from", isoDate, true),
  effectiveTo: field("Effective to", isoDate),
  siteId: field("Site", recordId),
}, [dateOrder("effectiveFrom", "effectiveTo", "Effective to")]);

export const siteChargeRateSchemas = bodySchemas({
  dutyTypeId: field("Duty type", recordId, true),
  hourlyChargeRate: field("Hourly charge rate", money(1000), true),
  effectiveFrom: field("Effective from", isoDate, true),
  effectiveTo: field("Effective to", isoDate),
}, [dateOrder("effectiveFrom", "effectiveTo", "Effective to")]);

export const employeePayRateSchemas = bodySchemas({
  dutyTypeId: field("Duty type", recordId, true),
  hourlyRate: field("Hourly rate", money(1000), true),
  effectiveFrom: field("Effective from", isoDate, true),
  effectiveTo: field("Effective to", isoDate),
}, [dateOrder("effectiveFrom", "effectiveTo", "Effective to")]);

export const supplierRateCardSchemas = bodySchemas({
  supplierId: field("Supplier", recordId, true),
  siteId: field("Site", recordId),
  employeeId: field("Employee", recordId),
  hourlyRate: field("Hourly rate", money(1000), true),
  overtimeRate: field("Overtime rate", money(1000)),
  effectiveFrom: field("Effective from", isoDate, true),
  effectiveTo: field("Effective to", isoDate),
}, [dateOrder("effectiveFrom", "effectiveTo", "Effective to")]);

export const employeeUpdateSchema = bodySchemas({
  firstName: field("First name", text(100), true),
  lastName: field("Last name", text(100), true),
  email: field("Email", email, true),
  phone: field("Phone", phone),
  secondPhone: field("Second phone", phone),
  nationalInsurance: field("National Insurance number", nationalInsurance),
  dateOfBirth: field("Date of birth", dateOfBirth),
  siaLicenseNumber: field("SIA licence number", siaLicence),
  siaExpiryDate: field("SIA expiry date", isoDate),
  startDate: field("Start date", isoDate),
  postcode: field("Postcode", ukPostcode),
  hourlyRate: field("Hourly rate", money(1000)),
}).update;

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; errors: Record<string, string> };

export function validateBody(schema: z.ZodTypeAny, body: unknown): ValidationResult {
  const result = schema.safeParse(body ?? {});
  if (result.success) return { ok: true };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "body";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, message: result.error.issues[0].message, errors };
}

/** Sends a 400 with field errors and returns true when the body is invalid. */
export function respondIfInvalid(res: Response, schema: z.ZodTypeAny, body: unknown): boolean {
  const result = validateBody(schema, body);
  if (result.ok) return false;
  res.status(400).json({ message: result.message, errors: result.errors });
  return true;
}

function comparable(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Keeps only the fields whose value differs from the stored record, so legacy data that predates
 * validation does not block saving unrelated changes from forms that resubmit every field.
 */
export function changedFieldsOnly(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
  columnFor: (key: string) => string = (key) => key,
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (comparable(value) !== comparable(existing[columnFor(key)])) changed[key] = value;
  }
  return changed;
}
