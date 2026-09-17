import { storage } from "./storage";
import type { Shift } from "@shared/schema";

export type ShiftNotifyAction = "created" | "updated" | "cancelled";

function norm(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function isNotifiableShiftPatch(data: Record<string, unknown>): boolean {
  if (data.status === "cancelled") return true;
  return ["date", "startTime", "endTime", "siteId", "title", "employeeId", "supplierId"]
    .some((key) => data[key] !== undefined);
}

export function classifyShiftUpdate(previous: Shift, updated: Shift): ShiftNotifyAction | null {
  if (norm(previous.status) !== "cancelled" && norm(updated.status) === "cancelled") {
    return "cancelled";
  }
  const changed = ["date", "startTime", "endTime", "siteId", "title", "employeeId", "supplierId"]
    .some((key) => norm((previous as any)[key]) !== norm((updated as any)[key]));
  return changed ? "updated" : null;
}

function formatShiftWhen(shift: Shift): string {
  const dateStr = String(shift.date).slice(0, 10);
  const parsed = new Date(`${dateStr}T00:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? dateStr
    : parsed.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${dateLabel} ${shift.startTime || ""}–${shift.endTime || ""}`.trim();
}

async function siteNameFor(shift: Shift): Promise<string> {
  if (!shift.siteId) return "";
  const site = await storage.getSite(shift.siteId);
  return site?.name || "";
}

async function officerUserId(employeeId: number | null | undefined): Promise<string | null> {
  if (!employeeId) return null;
  const employee = await storage.getEmployee(employeeId);
  return employee?.userId || null;
}

async function supplierPortalUserId(supplierId: number | null | undefined): Promise<string | null> {
  if (!supplierId) return null;
  const supplier = await storage.getSupplier(supplierId);
  return supplier?.userId || null;
}

async function send(
  userId: string,
  type: string,
  title: string,
  body: string,
  link: string,
  shift: Shift,
) {
  await storage.createNotification({
    userId,
    type,
    title,
    body,
    link,
    relatedEntityType: "shift",
    relatedEntityId: String(shift.id),
    metadata: {
      shiftId: shift.id,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      siteId: shift.siteId,
    },
  });
}

function copyFor(
  audience: "officer" | "supplier",
  action: ShiftNotifyAction,
  summary: string,
): { type: string; title: string; body: string; link: string } {
  if (audience === "officer") {
    if (action === "created") {
      return { type: "shift_assigned", title: "New shift assigned", body: `You have been assigned ${summary}.`, link: "/my-shifts" };
    }
    if (action === "cancelled") {
      return { type: "shift_cancelled", title: "Shift cancelled", body: `Your shift has been cancelled: ${summary}.`, link: "/my-shifts" };
    }
    return { type: "shift_updated", title: "Shift updated", body: `Your shift has been updated: ${summary}.`, link: "/my-shifts" };
  }
  if (action === "created") {
    return { type: "shift_assigned", title: "New shift assigned", body: `A shift has been assigned to your company: ${summary}.`, link: "/supplier-timesheets" };
  }
  if (action === "cancelled") {
    return { type: "shift_cancelled", title: "Shift cancelled", body: `A shift for your company has been cancelled: ${summary}.`, link: "/supplier-timesheets" };
  }
  return { type: "shift_updated", title: "Shift updated", body: `A shift for your company has been updated: ${summary}.`, link: "/supplier-timesheets" };
}

export async function notifyShiftStakeholders(opts: {
  shift: Shift;
  previous?: Shift | null;
  action: ShiftNotifyAction;
}): Promise<void> {
  const { shift, previous, action } = opts;
  const siteName = await siteNameFor(shift);
  const summary = `"${shift.title || "Shift"}" · ${formatShiftWhen(shift)}${siteName ? ` at ${siteName}` : ""}`;

  const currentOfficer = await officerUserId(shift.employeeId);
  const currentSupplier = await supplierPortalUserId(shift.supplierId);
  const previousOfficer = previous ? await officerUserId(previous.employeeId) : null;
  const previousSupplier = previous ? await supplierPortalUserId(previous.supplierId) : null;
  const sent = new Set<string>();

  const notify = async (userId: string | null, audience: "officer" | "supplier", act: ShiftNotifyAction) => {
    if (!userId || sent.has(`${userId}:${act}`)) return;
    sent.add(`${userId}:${act}`);
    const msg = copyFor(audience, act, summary);
    await send(userId, msg.type, msg.title, msg.body, msg.link, shift);
  };

  if (action === "created") {
    await notify(currentOfficer, "officer", "created");
    await notify(currentSupplier, "supplier", "created");
    return;
  }

  if (action === "cancelled") {
    await notify(currentOfficer, "officer", "cancelled");
    await notify(currentSupplier, "supplier", "cancelled");
    if (previousOfficer && previousOfficer !== currentOfficer) {
      await notify(previousOfficer, "officer", "cancelled");
    }
    if (previousSupplier && previousSupplier !== currentSupplier) {
      await notify(previousSupplier, "supplier", "cancelled");
    }
    return;
  }

  if (previousOfficer && previousOfficer !== currentOfficer) {
    const prevSite = previous?.siteId ? (await storage.getSite(previous.siteId))?.name || "" : siteName;
    const prevSummary = previous
      ? `"${previous.title || "Shift"}" · ${formatShiftWhen(previous)}${prevSite ? ` at ${prevSite}` : ""}`
      : summary;
    if (previousOfficer) {
      sent.add(`${previousOfficer}:cancelled`);
      const msg = copyFor("officer", "cancelled", prevSummary);
      msg.title = "Removed from shift";
      msg.body = `You have been removed from ${prevSummary}.`;
      await send(previousOfficer, "shift_cancelled", msg.title, msg.body, msg.link, previous || shift);
    }
  }
  if (currentOfficer) {
    await notify(currentOfficer, "officer", previousOfficer !== currentOfficer ? "created" : "updated");
  }

  if (previousSupplier && previousSupplier !== currentSupplier) {
    await notify(previousSupplier, "supplier", "cancelled");
  }
  if (currentSupplier) {
    await notify(currentSupplier, "supplier", previousSupplier !== currentSupplier ? "created" : "updated");
  }
}

export function queueShiftNotification(opts: {
  shift: Shift;
  previous?: Shift | null;
  action: ShiftNotifyAction;
}): void {
  void notifyShiftStakeholders(opts).catch((err) => {
    console.error("[shift-notifications]", err);
  });
}
