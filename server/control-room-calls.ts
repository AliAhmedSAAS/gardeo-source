import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  employees,
  shiftCheckCalls,
  shifts,
  sites,
  users,
  type ShiftCheckCall,
} from "@shared/schema";
import { sendViaTenantEmailSettings } from "./tenant-email-settings";

const PRECHECK_VISIBLE_MINUTES_BEFORE = 90;
const BOOK_ON_VISIBLE_MINUTES_BEFORE = 15;

export const PRECHECK_REASONS = [
  "No internet",
  "Pre-check by contractor",
  "Phone broken",
  "Client does not allow phone",
  "Officer does not know the app",
  "Other",
] as const;

export const BOOK_ON_REASONS = [
  "Internet issue",
  "Phone broken",
  "Client does not allow phone",
  "Does not know the app",
  "Other",
] as const;

export const CHECK_CALL_REASONS = [
  "No internet",
  "Phone broken",
  "Battery dead",
  "Link not working",
  "Shared live location",
  "Shared timestamp photo",
  "Phone not allowed on site",
  "Client will take check-calls",
  "Check-call by contractor",
  "Other",
] as const;

function requireReason(reason: string | undefined, reasonOther: string | undefined, allowed: readonly string[]) {
  const r = (reason || "").trim();
  if (!r || !allowed.includes(r)) {
    return { ok: false as const, message: "A valid reason is required" };
  }
  if (r === "Other" && !(reasonOther || "").trim()) {
    return { ok: false as const, message: "Please provide details for Other" };
  }
  return { ok: true as const, reason: r, reasonOther: r === "Other" ? (reasonOther || "").trim() : null };
}

function parseTimeOnDate(dateStr: string, timeStr: string): Date {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${t}`);
}

/** True once we are within `minutesBefore` of shift start (and afterwards if still pending). */
function isWithinMinutesBeforeStart(dateStr: string, startTime: string, minutesBefore: number, now = new Date()): boolean {
  if (!dateStr || !startTime) return false;
  const start = parseTimeOnDate(dateStr, startTime);
  if (Number.isNaN(start.getTime())) return false;
  const windowOpensAt = new Date(start.getTime() - minutesBefore * 60 * 1000);
  return now.getTime() >= windowOpensAt.getTime();
}

/** Create pending check-call slots from book-on until shift end using site settings. */
export async function ensureCheckCallsForShift(shiftId: number, tenantId: number | null): Promise<void> {
  const shift = await storage.getShift(shiftId);
  if (!shift?.date || !shift.startTime || !shift.endTime) return;

  const site = shift.siteId ? await storage.getSite(shift.siteId) : null;
  if (site && site.checkCallEnabled === false) return;

  const intervalMinutes = Math.max(15, site?.checkCallIntervalMinutes ?? 60);
  const scheduleMode = (site?.checkCallScheduleMode || "full_day") as "full_day" | "day" | "night";

  const existing = await db
    .select({ id: shiftCheckCalls.id })
    .from(shiftCheckCalls)
    .where(eq(shiftCheckCalls.shiftId, shiftId))
    .limit(1);
  if (existing.length > 0) return;

  const bookOn = shift.bookedOnAt
    ? new Date(shift.bookedOnAt)
    : shift.checkInTime
      ? new Date(shift.checkInTime)
      : parseTimeOnDate(String(shift.date).slice(0, 10), shift.startTime);

  let end = parseTimeOnDate(String(shift.date).slice(0, 10), shift.endTime);
  if (end <= bookOn) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  function allowedAt(dt: Date): boolean {
    const h = dt.getHours() + dt.getMinutes() / 60;
    if (scheduleMode === "day") return h >= 6 && h < 18;
    if (scheduleMode === "night") return h >= 18 || h < 6;
    return true;
  }

  const rows: { tenantId: number | null; shiftId: number; dueAt: Date; status: string }[] = [];
  let cursor = new Date(bookOn.getTime() + intervalMinutes * 60 * 1000);
  while (cursor < end) {
    if (allowedAt(cursor)) {
      rows.push({
        tenantId,
        shiftId,
        dueAt: new Date(cursor),
        status: "pending",
      });
    }
    cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
  }

  if (rows.length === 0 && scheduleMode === "full_day") {
    if (end.getTime() - bookOn.getTime() > 60 * 60 * 1000) {
      rows.push({
        tenantId,
        shiftId,
        dueAt: new Date(bookOn.getTime() + Math.min((end.getTime() - bookOn.getTime()) / 2, intervalMinutes * 60 * 1000)),
        status: "pending",
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(shiftCheckCalls).values(rows);
  }
}

export type PendingCallRow = {
  id: string;
  callType: "precheck" | "book_on" | "check_call";
  shiftId: number;
  checkCallId?: number;
  dueAt: string | null;
  siteId: number | null;
  siteName: string;
  employeeName: string;
  employeePhone: string | null;
  siaLicenseNumber: string | null;
  startTime: string;
  endTime: string;
  date: string;
  status: "pending" | "taken_manual" | "taken_app";
  clientEmail: string | null;
  bookOnEmail: string | null;
  managerEmail: string | null;
  managerName: string | null;
  clientName: string | null;
  precheckTaken: boolean;
  bookOnTaken: boolean;
};

export async function listPendingCalls(tenantId: number): Promise<PendingCallRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = await db
    .select({
      shift: shifts,
      siteName: sites.name,
      siteBookOnEmail: sites.bookOnEmail,
      siteManagerEmail: sites.managerEmail,
      siteManagerName: sites.managerName,
      siteClientEmail: sites.clientEmail,
      siteClientName: sites.clientName,
      empFirst: users.firstName,
      empLast: users.lastName,
      empPhone: users.phone,
      siaNumber: employees.siaLicenseNumber,
    })
    .from(shifts)
    .leftJoin(sites, eq(shifts.siteId, sites.id))
    .leftJoin(employees, eq(shifts.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(
      eq(shifts.tenantId, tenantId),
      sql`${shifts.date}::text = ${today}`,
      inArray(shifts.status, ["scheduled", "in_progress", "booked_on"]),
    ));

  const rows: PendingCallRow[] = [];
  const now = new Date();

  for (const row of todayShifts) {
    const s = row.shift;
    const employeeName = [row.empFirst, row.empLast].filter(Boolean).join(" ") || "Unassigned";
    const siteName = row.siteName || "Unassigned";
    const dateStr = String(s.date).slice(0, 10);
    const clientEmail = row.siteBookOnEmail || row.siteClientEmail || row.siteManagerEmail || null;

    const precheckPassed = Boolean(s.precheckData?.passed);
    const bookOnDone = Boolean(s.bookedOnAt || s.checkInTime || s.status === "booked_on" || s.status === "in_progress");

    if (
      s.status === "scheduled" &&
      !precheckPassed &&
      isWithinMinutesBeforeStart(dateStr, s.startTime, PRECHECK_VISIBLE_MINUTES_BEFORE, now)
    ) {
      rows.push({
        id: `precheck-${s.id}`,
        callType: "precheck",
        shiftId: s.id,
        dueAt: `${dateStr}T${s.startTime}:00`,
        siteId: s.siteId,
        siteName,
        employeeName,
        employeePhone: row.empPhone || null,
        siaLicenseNumber: row.siaNumber || null,
        startTime: s.startTime,
        endTime: s.endTime,
        date: dateStr,
        status: "pending",
        clientEmail,
        bookOnEmail: row.siteBookOnEmail || null,
        managerEmail: row.siteManagerEmail || null,
        managerName: row.siteManagerName || null,
        clientName: row.siteClientName || null,
        precheckTaken: false,
        bookOnTaken: false,
      });
    }

    // Book-on pending: precheck done, scheduled, not booked yet — only from 15 min before start
    if (
      s.status === "scheduled" &&
      precheckPassed &&
      !bookOnDone &&
      isWithinMinutesBeforeStart(dateStr, s.startTime, BOOK_ON_VISIBLE_MINUTES_BEFORE, now)
    ) {
      rows.push({
        id: `bookon-${s.id}`,
        callType: "book_on",
        shiftId: s.id,
        dueAt: `${dateStr}T${s.startTime}:00`,
        siteId: s.siteId,
        siteName,
        employeeName,
        employeePhone: row.empPhone || null,
        siaLicenseNumber: row.siaNumber || null,
        startTime: s.startTime,
        endTime: s.endTime,
        date: dateStr,
        status: "pending",
        clientEmail,
        bookOnEmail: row.siteBookOnEmail || null,
        managerEmail: row.siteManagerEmail || null,
        managerName: row.siteManagerName || null,
        clientName: row.siteClientName || null,
        precheckTaken: true,
        bookOnTaken: false,
      });
    }

    // Ensure check-calls for active booked shifts
    if (bookOnDone && (s.status === "booked_on" || s.status === "in_progress")) {
      await ensureCheckCallsForShift(s.id, tenantId);
    }
  }

  // Due pending check-calls
  const dueCalls = await db
    .select({
      call: shiftCheckCalls,
      shift: shifts,
      siteName: sites.name,
      siteBookOnEmail: sites.bookOnEmail,
      siteManagerEmail: sites.managerEmail,
      siteManagerName: sites.managerName,
      siteClientEmail: sites.clientEmail,
      siteClientName: sites.clientName,
      empFirst: users.firstName,
      empLast: users.lastName,
      empPhone: users.phone,
      siaNumber: employees.siaLicenseNumber,
    })
    .from(shiftCheckCalls)
    .innerJoin(shifts, eq(shiftCheckCalls.shiftId, shifts.id))
    .leftJoin(sites, eq(shifts.siteId, sites.id))
    .leftJoin(employees, eq(shifts.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(
      eq(shiftCheckCalls.tenantId, tenantId),
      eq(shiftCheckCalls.status, "pending"),
      lte(shiftCheckCalls.dueAt, now),
      inArray(shifts.status, ["booked_on", "in_progress"]),
      sql`${shifts.date}::text = ${today}`,
    ))
    .orderBy(asc(shiftCheckCalls.dueAt));

  for (const row of dueCalls) {
    const s = row.shift;
    rows.push({
      id: `checkcall-${row.call.id}`,
      callType: "check_call",
      shiftId: s.id,
      checkCallId: row.call.id,
      dueAt: row.call.dueAt ? new Date(row.call.dueAt).toISOString() : null,
      siteId: s.siteId,
      siteName: row.siteName || "Unassigned",
      employeeName: [row.empFirst, row.empLast].filter(Boolean).join(" ") || "Unassigned",
      employeePhone: row.empPhone || null,
      siaLicenseNumber: row.siaNumber || null,
      startTime: s.startTime,
      endTime: s.endTime,
      date: String(s.date).slice(0, 10),
      status: "pending",
      clientEmail: row.siteBookOnEmail || row.siteClientEmail || row.siteManagerEmail || null,
      bookOnEmail: row.siteBookOnEmail || null,
      managerEmail: row.siteManagerEmail || null,
      managerName: row.siteManagerName || null,
      clientName: row.siteClientName || null,
      precheckTaken: true,
      bookOnTaken: true,
    });
  }

  // Sort: precheck, book_on, check_call; then dueAt
  const order = { precheck: 0, book_on: 1, check_call: 2 };
  rows.sort((a, b) => {
    const d = order[a.callType] - order[b.callType];
    if (d !== 0) return d;
    return (a.dueAt || "").localeCompare(b.dueAt || "");
  });

  return rows;
}

export async function takePrecheck(params: {
  shiftId: number;
  tenantId: number;
  userId: string;
  reason?: string;
  reasonOther?: string;
  reverse?: boolean;
}) {
  const shift = await storage.getShift(params.shiftId, params.tenantId);
  if (!shift) return { ok: false as const, status: 404, message: "Shift not found" };

  if (params.reverse) {
    if (!shift.precheckData?.passed) {
      return { ok: false as const, status: 400, message: "Precheck is not taken" };
    }
    if (shift.precheckData.method === "app") {
      return { ok: false as const, status: 400, message: "Cannot reverse an app-completed precheck" };
    }
    if (shift.bookedOnAt || shift.status === "booked_on" || shift.status === "in_progress") {
      return { ok: false as const, status: 400, message: "Cannot reverse precheck after book-on" };
    }
    const updated = await storage.updateShift(params.shiftId, { precheckData: null } as any);
    return { ok: true as const, shift: updated };
  }

  if (shift.precheckData?.passed) {
    return { ok: false as const, status: 400, message: "Precheck already completed" };
  }

  const reasonCheck = requireReason(params.reason, params.reasonOther, PRECHECK_REASONS);
  if (!reasonCheck.ok) return { ok: false as const, status: 400, message: reasonCheck.message };

  const now = new Date().toISOString();
  const precheckData = {
    siaValid: true,
    dbsValid: true,
    uniformConfirmed: true,
    equipmentConfirmed: true,
    welfareChecked: true,
    checkedBy: params.userId,
    checkedAt: now,
    passed: true,
    method: "manual" as const,
    reason: reasonCheck.reason,
    reasonOther: reasonCheck.reasonOther || undefined,
  };

  const updated = await storage.updateShift(params.shiftId, { precheckData } as any);
  return { ok: true as const, shift: updated };
}

export async function takeBookOn(params: {
  shiftId: number;
  tenantId: number;
  userId: string;
  reason?: string;
  reasonOther?: string;
  bookOnTime?: string;
  photoUrl?: string;
  emailTo?: string;
  customerName?: string;
  message?: string;
  fromAddress?: string;
  notifyOfficer?: boolean;
}) {
  const shift = await storage.getShift(params.shiftId, params.tenantId);
  if (!shift) return { ok: false as const, status: 404, message: "Shift not found" };

  if (shift.bookedOnAt || shift.status === "booked_on" || shift.status === "in_progress") {
    if (shift.bookOnCallData?.method === "app" || (!shift.bookOnCallData && shift.bookedOnAt)) {
      return { ok: false as const, status: 400, message: "Book-on already completed" };
    }
    return { ok: false as const, status: 400, message: "Book-on already completed" };
  }

  if (!shift.precheckData?.passed) {
    return { ok: false as const, status: 400, message: "Complete precheck before book-on" };
  }

  const reasonCheck = requireReason(params.reason, params.reasonOther, BOOK_ON_REASONS);
  if (!reasonCheck.ok) return { ok: false as const, status: 400, message: reasonCheck.message };

  if (!(params.photoUrl || "").trim()) {
    return { ok: false as const, status: 400, message: "Timestamp photo is required" };
  }
  if (!(params.bookOnTime || "").trim()) {
    return { ok: false as const, status: 400, message: "Book-on time is required" };
  }

  const site = shift.siteId ? await storage.getSite(shift.siteId) : null;
  const emailEnabled = site?.bookOnEmailEnabled !== false;
  const emailTo = (params.emailTo || site?.bookOnEmail || site?.clientEmail || site?.managerEmail || "").trim();
  if (emailEnabled && !emailTo) {
    return { ok: false as const, status: 400, message: "Site/customer has no email — cannot take book-on" };
  }

  const dateStr = String(shift.date).slice(0, 10);
  const timeStr = params.bookOnTime!.trim();
  const bookOnAt = parseTimeOnDate(dateStr, timeStr.length <= 5 ? timeStr : timeStr.slice(11, 16));

  let lateMinutes = 0;
  if (shift.startTime) {
    const scheduledStart = parseTimeOnDate(dateStr, shift.startTime);
    if (bookOnAt > scheduledStart) {
      lateMinutes = Math.ceil((bookOnAt.getTime() - scheduledStart.getTime()) / 60000);
    }
  }

  const employee = shift.employeeId ? await storage.getEmployee(shift.employeeId) : null;
  const empUser = employee?.userId ? await storage.getUser(employee.userId) : null;
  const officerName = empUser ? `${empUser.firstName} ${empUser.lastName}`.trim() : "Officer";
  const customerName = (params.customerName || site?.clientName || site?.managerName || site?.name || "Customer").trim();
  const sia = employee?.siaLicenseNumber || "N/A";

  let emailQueued = false;
  let sendResult: { ok: boolean; error?: string } = { ok: true };
  if (emailEnabled && emailTo) {
    const subject = `Book-on confirmation — ${site?.name || "Site"}`;
    const html = `
      <p>Dear ${customerName},</p>
      <p>This is to confirm that <strong>${officerName}</strong> (SIA: ${sia}) has booked on at <strong>${site?.name || "site"}</strong> at <strong>${timeStr}</strong>.</p>
      ${params.message ? `<p>${params.message}</p>` : ""}
      <p>Kind regards,<br/>Control Room</p>
    `;
    sendResult = await sendViaTenantEmailSettings({
      tenantId: params.tenantId,
      to: emailTo,
      subject,
      html,
    });
    if (sendResult.ok) emailQueued = true;
  }

  const now = new Date();
  const bookOnCallData = {
    method: "manual" as const,
    reason: reasonCheck.reason,
    reasonOther: reasonCheck.reasonOther || undefined,
    photoUrl: params.photoUrl!.trim(),
    takenBy: params.userId,
    takenAt: now.toISOString(),
    bookOnTime: timeStr,
    emailTo,
    emailQueued,
  };

  const updated = await storage.updateShift(params.shiftId, {
    status: "booked_on",
    bookedOnAt: bookOnAt,
    bookedOnBy: params.userId,
    checkInTime: bookOnAt,
    lateMinutes,
    bookOnCallData,
  } as any);

  await ensureCheckCallsForShift(params.shiftId, params.tenantId);

  if (params.notifyOfficer && empUser?.email && !empUser.email.includes("@needs-onboarding") && !empUser.email.includes("@placeholder")) {
    await sendViaTenantEmailSettings({
      tenantId: params.tenantId,
      to: empUser.email,
      subject: "Please use the app for book-on",
      html: `<p>Hi ${officerName},</p><p>Your book-on for ${site?.name || "your shift"} was completed manually by Control Room. Please use the mobile app for future book-ons.</p>`,
    }).catch(() => null);
  }

  return {
    ok: true as const,
    shift: updated,
    emailQueued,
    emailError: sendResult.ok ? undefined : sendResult.error,
  };
}

export async function takeCheckCall(params: {
  checkCallId: number;
  tenantId: number;
  userId: string;
  reason?: string;
  reasonOther?: string;
  photoUrl?: string;
}) {
  const [call] = await db
    .select()
    .from(shiftCheckCalls)
    .where(and(eq(shiftCheckCalls.id, params.checkCallId), eq(shiftCheckCalls.tenantId, params.tenantId)))
    .limit(1);
  if (!call) return { ok: false as const, status: 404, message: "Check-call not found" };
  if (call.status !== "pending") {
    return { ok: false as const, status: 400, message: "Check-call already taken" };
  }

  const reasonCheck = requireReason(params.reason, params.reasonOther, CHECK_CALL_REASONS);
  if (!reasonCheck.ok) return { ok: false as const, status: 400, message: reasonCheck.message };
  if (!(params.photoUrl || "").trim()) {
    return { ok: false as const, status: 400, message: "Timestamp photo is required" };
  }

  const now = new Date();
  const [updated] = await db
    .update(shiftCheckCalls)
    .set({
      status: "taken_manual",
      takenAt: now,
      takenBy: params.userId,
      method: "manual",
      reason: reasonCheck.reason,
      reasonOther: reasonCheck.reasonOther,
      photoUrl: params.photoUrl!.trim(),
    })
    .where(eq(shiftCheckCalls.id, params.checkCallId))
    .returning();

  return { ok: true as const, checkCall: updated as ShiftCheckCall };
}

/** Shifts that have manual precheck taken (for reverse UI). */
export async function listReversiblePrechecks(tenantId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      shift: shifts,
      siteName: sites.name,
      empFirst: users.firstName,
      empLast: users.lastName,
    })
    .from(shifts)
    .leftJoin(sites, eq(shifts.siteId, sites.id))
    .leftJoin(employees, eq(shifts.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(
      eq(shifts.tenantId, tenantId),
      sql`${shifts.date}::text = ${today}`,
      eq(shifts.status, "scheduled"),
      sql`${shifts.precheckData}->>'passed' = 'true'`,
      sql`(${shifts.precheckData}->>'method' = 'manual' OR ${shifts.precheckData}->>'method' IS NULL)`,
      isNull(shifts.bookedOnAt),
    ));
  return rows.map((r) => ({
    id: `precheck-taken-${r.shift.id}`,
    callType: "precheck" as const,
    shiftId: r.shift.id,
    siteName: r.siteName || "Unassigned",
    employeeName: [r.empFirst, r.empLast].filter(Boolean).join(" ") || "Unassigned",
    startTime: r.shift.startTime,
    endTime: r.shift.endTime,
    status: "taken_manual" as const,
    reason: r.shift.precheckData?.reason || null,
  }));
}
