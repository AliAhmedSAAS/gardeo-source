import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  employees,
  incidents,
  mcpProposals,
  sites,
  type McpProposal,
  type McpProposalType,
} from "@shared/schema";
import { storage } from "../storage";
import type { McpAuthContext } from "./context";
import { sanitizeShift } from "./sanitize";

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export type CreateShiftPayload = {
  siteId: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  employeeId?: number | null;
  supplierId?: number | null;
  dutyTypeId?: number | null;
  breakMinutes?: number | null;
  notes?: string | null;
};

export type HandoverNotePayload = {
  shiftId: number;
  note: string;
  mode?: "append" | "replace";
};

export type AcknowledgeIncidentPayload = {
  incidentId: number;
};

export type AssignOfficerPayload = {
  shiftId: number;
  employeeId: number;
};

export type CancelShiftPayload = {
  shiftId: number;
  reason?: string | null;
};

export type BookOnPayload = {
  shiftId: number;
};

export type BookOffPayload = {
  shiftId: number;
  handoverNote?: string | null;
};

function generateConfirmToken(): { raw: string; hash: string } {
  const raw = `mcp_confirm_${crypto.randomBytes(24).toString("hex")}`;
  return { raw, hash: bcrypt.hashSync(raw, 10) };
}

async function assertSiteOwned(tenantId: number, siteId: number) {
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
    .limit(1);
  if (!site) throw new Error("Site not found in this tenant");
}

async function assertEmployeeOwned(tenantId: number, employeeId: number) {
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);
  if (!emp) throw new Error("Employee not found in this tenant");
}

export async function createProposal(
  ctx: McpAuthContext,
  proposalType: McpProposalType,
  payload: Record<string, unknown>,
  summary: string,
): Promise<{ proposal: McpProposal; confirmToken: string }> {
  const { raw, hash } = generateConfirmToken();
  const [proposal] = await db
    .insert(mcpProposals)
    .values({
      tenantId: ctx.tenantId,
      clientId: ctx.clientId ?? null,
      apiKeyId: ctx.apiKeyId ?? null,
      proposalType,
      payload,
      summary,
      confirmTokenHash: hash,
      status: "pending",
      expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS),
    })
    .returning();

  await storage.createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.userId ?? undefined,
    action: "mcp_proposal_created",
    entityType: "mcp_proposal",
    entityId: String(proposal.id),
    details: { proposalType, summary, clientId: ctx.clientId, authType: ctx.authType },
    ipAddress: ctx.ipAddress ?? undefined,
  });

  return { proposal, confirmToken: raw };
}

async function loadPendingProposal(tenantId: number, proposalId: number): Promise<McpProposal> {
  const [proposal] = await db
    .select()
    .from(mcpProposals)
    .where(and(eq(mcpProposals.id, proposalId), eq(mcpProposals.tenantId, tenantId)))
    .limit(1);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "pending") throw new Error(`Proposal is ${proposal.status}`);
  if (new Date(proposal.expiresAt) < new Date()) {
    await db
      .update(mcpProposals)
      .set({ status: "expired" })
      .where(eq(mcpProposals.id, proposal.id));
    throw new Error("Proposal has expired");
  }
  return proposal;
}

async function verifyConfirmToken(proposal: McpProposal, confirmToken: string | undefined, requireToken: boolean) {
  if (!requireToken) return;
  if (!confirmToken) throw new Error("confirmToken is required");
  const ok = await bcrypt.compare(confirmToken, proposal.confirmTokenHash);
  if (!ok) throw new Error("Invalid confirmToken");
}

async function executeProposal(proposal: McpProposal): Promise<Record<string, unknown>> {
  const type = proposal.proposalType as McpProposalType;
  const payload = proposal.payload as Record<string, unknown>;

  if (type === "create_shift") {
    const p = payload as CreateShiftPayload;
    await assertSiteOwned(proposal.tenantId, p.siteId);
    if (p.employeeId) await assertEmployeeOwned(proposal.tenantId, p.employeeId);

    let payRate: string | null = null;
    let chargeRate: string | null = null;
    try {
      const { resolveShiftRates } = await import("../shift-rate-resolver");
      const rates = await resolveShiftRates({
        tenantId: proposal.tenantId,
        siteId: p.siteId,
        employeeId: p.employeeId ?? null,
        supplierId: p.supplierId ?? null,
        dutyTypeId: p.dutyTypeId ?? null,
        date: p.date,
      });
      payRate = rates.payRate;
      chargeRate = rates.chargeRate;
    } catch {
      // Rate resolution is best-effort for MCP proposals.
    }

    const shift = await storage.createShift({
      tenantId: proposal.tenantId,
      siteId: p.siteId,
      title: p.title,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      employeeId: p.employeeId ?? null,
      supplierId: p.supplierId ?? null,
      dutyTypeId: p.dutyTypeId ?? null,
      breakMinutes: p.breakMinutes ?? 0,
      notes: p.notes ?? null,
      status: "scheduled",
      payRate,
      chargeRate,
    } as any);

    return { shift: sanitizeShift(shift as unknown as Record<string, unknown>) };
  }

  if (type === "add_handover_note") {
    const p = payload as HandoverNotePayload;
    const shift = await storage.getShift(p.shiftId, proposal.tenantId);
    if (!shift) throw new Error("Shift not found");
    const mode = p.mode === "replace" ? "replace" : "append";
    const stamped = `[MCP ${new Date().toISOString()}] ${p.note.trim()}`;
    const nextNotes =
      mode === "replace" || !shift.handoverNotes
        ? stamped
        : `${shift.handoverNotes.trim()}\n${stamped}`;
    const updated = await storage.updateShift(p.shiftId, { handoverNotes: nextNotes } as any);
    return {
      shiftId: p.shiftId,
      handoverNotes: updated?.handoverNotes ?? nextNotes,
    };
  }

  if (type === "acknowledge_incident") {
    const p = payload as AcknowledgeIncidentPayload;
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, p.incidentId), eq(incidents.tenantId, proposal.tenantId)))
      .limit(1);
    if (!incident) throw new Error("Incident not found");
    if (incident.status !== "reported" && incident.status !== "investigating") {
      throw new Error(`Cannot acknowledge incident with status '${incident.status}'`);
    }
    const [updated] = await db
      .update(incidents)
      .set({
        status: "investigating",
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, incident.id), eq(incidents.tenantId, proposal.tenantId)))
      .returning();
    return {
      incident: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        severity: updated.severity,
        siteId: updated.siteId,
      },
    };
  }

  if (type === "assign_officer") {
    const p = payload as AssignOfficerPayload;
    const shift = await storage.getShift(p.shiftId, proposal.tenantId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status === "cancelled" || shift.status === "completed") {
      throw new Error(`Cannot assign officer to a '${shift.status}' shift`);
    }
    await assertEmployeeOwned(proposal.tenantId, p.employeeId);
    const updated = await storage.updateShift(p.shiftId, { employeeId: p.employeeId } as any);
    return { shift: sanitizeShift((updated || shift) as unknown as Record<string, unknown>) };
  }

  if (type === "cancel_shift") {
    const p = payload as CancelShiftPayload;
    const shift = await storage.getShift(p.shiftId, proposal.tenantId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status === "cancelled") throw new Error("Shift is already cancelled");
    if (shift.status === "completed" || shift.status === "verified") {
      throw new Error(`Cannot cancel a '${shift.status}' shift`);
    }
    const note = p.reason?.trim()
      ? `[MCP cancel ${new Date().toISOString()}] ${p.reason.trim()}`
      : null;
    const nextNotes = note
      ? shift.notes
        ? `${shift.notes.trim()}\n${note}`
        : note
      : shift.notes;
    const updated = await storage.updateShift(p.shiftId, {
      status: "cancelled",
      ...(nextNotes != null ? { notes: nextNotes } : {}),
    } as any);
    return { shift: sanitizeShift((updated || { ...shift, status: "cancelled" }) as unknown as Record<string, unknown>) };
  }

  if (type === "book_on") {
    const p = payload as BookOnPayload;
    const shift = await storage.getShift(p.shiftId, proposal.tenantId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status !== "scheduled") {
      throw new Error(`Cannot book on a shift with status '${shift.status}'`);
    }
    const now = new Date();
    const { calculateLateDeduction, shiftDateTime } = await import("@shared/lateDeduction");
    const late = calculateLateDeduction(shiftDateTime(shift.date, shift.startTime), now);
    const updated = await storage.updateShift(p.shiftId, {
      status: "booked_on",
      bookedOnAt: now,
      checkInTime: now,
      lateMinutes: late.lateMinutes,
      lateHours: late.lateHours,
    } as any);
    return {
      shift: sanitizeShift((updated || shift) as unknown as Record<string, unknown>),
      lateMinutes: late.lateMinutes,
      lateHours: late.lateHours,
    };
  }

  if (type === "book_off") {
    const p = payload as BookOffPayload;
    const shift = await storage.getShift(p.shiftId, proposal.tenantId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status !== "booked_on" && shift.status !== "in_progress") {
      throw new Error(`Cannot book off a shift with status '${shift.status}'`);
    }
    const now = new Date();
    let handoverNotes = shift.handoverNotes;
    if (p.handoverNote?.trim()) {
      const stamped = `[MCP ${now.toISOString()}] ${p.handoverNote.trim()}`;
      handoverNotes = handoverNotes ? `${handoverNotes.trim()}\n${stamped}` : stamped;
    }
    const updated = await storage.updateShift(p.shiftId, {
      status: "booked_off",
      bookedOffAt: now,
      checkOutTime: now,
      ...(handoverNotes != null ? { handoverNotes } : {}),
    } as any);
    return { shift: sanitizeShift((updated || shift) as unknown as Record<string, unknown>) };
  }

  throw new Error(`Unsupported proposal type: ${type}`);
}

export async function confirmProposal(opts: {
  tenantId: number;
  proposalId: number;
  confirmToken?: string;
  requireToken: boolean;
  confirmedByUserId?: string | null;
  ipAddress?: string | null;
  clientId?: number | null;
}): Promise<{ proposal: McpProposal; result: Record<string, unknown> }> {
  const proposal = await loadPendingProposal(opts.tenantId, opts.proposalId);
  if (opts.clientId != null && proposal.clientId != null && proposal.clientId !== opts.clientId) {
    throw new Error("Proposal does not belong to this MCP client");
  }
  await verifyConfirmToken(proposal, opts.confirmToken, opts.requireToken);

  try {
    const result = await executeProposal(proposal);
    const [updated] = await db
      .update(mcpProposals)
      .set({
        status: "confirmed",
        result,
        confirmedAt: new Date(),
        confirmedByUserId: opts.confirmedByUserId ?? null,
        errorMessage: null,
      })
      .where(eq(mcpProposals.id, proposal.id))
      .returning();

    await storage.createAuditLog({
      tenantId: opts.tenantId,
      userId: opts.confirmedByUserId ?? undefined,
      action: "mcp_proposal_confirmed",
      entityType: "mcp_proposal",
      entityId: String(proposal.id),
      details: { proposalType: proposal.proposalType, result },
      ipAddress: opts.ipAddress ?? undefined,
    });

    return { proposal: updated, result };
  } catch (err: any) {
    const message = err?.message || "Proposal execution failed";
    await db
      .update(mcpProposals)
      .set({
        status: "failed",
        errorMessage: message.slice(0, 500),
        confirmedAt: new Date(),
        confirmedByUserId: opts.confirmedByUserId ?? null,
      })
      .where(eq(mcpProposals.id, proposal.id));
    throw new Error(message);
  }
}

export async function rejectProposal(opts: {
  tenantId: number;
  proposalId: number;
  confirmToken?: string;
  requireToken: boolean;
  rejectedByUserId?: string | null;
  ipAddress?: string | null;
  clientId?: number | null;
}): Promise<McpProposal> {
  const proposal = await loadPendingProposal(opts.tenantId, opts.proposalId);
  if (opts.clientId != null && proposal.clientId != null && proposal.clientId !== opts.clientId) {
    throw new Error("Proposal does not belong to this MCP client");
  }
  await verifyConfirmToken(proposal, opts.confirmToken, opts.requireToken);

  const [updated] = await db
    .update(mcpProposals)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedByUserId: opts.rejectedByUserId ?? null,
    })
    .where(eq(mcpProposals.id, proposal.id))
    .returning();

  await storage.createAuditLog({
    tenantId: opts.tenantId,
    userId: opts.rejectedByUserId ?? undefined,
    action: "mcp_proposal_rejected",
    entityType: "mcp_proposal",
    entityId: String(proposal.id),
    details: { proposalType: proposal.proposalType },
    ipAddress: opts.ipAddress ?? undefined,
  });

  return updated;
}

export async function listProposals(
  tenantId: number,
  opts?: { status?: string; limit?: number; clientId?: number },
) {
  const limit = Math.min(opts?.limit ?? 50, 200);
  const conditions = [eq(mcpProposals.tenantId, tenantId)];
  if (opts?.status) conditions.push(eq(mcpProposals.status, opts.status));
  if (opts?.clientId != null) conditions.push(eq(mcpProposals.clientId, opts.clientId));

  return db
    .select({
      id: mcpProposals.id,
      tenantId: mcpProposals.tenantId,
      clientId: mcpProposals.clientId,
      proposalType: mcpProposals.proposalType,
      summary: mcpProposals.summary,
      payload: mcpProposals.payload,
      status: mcpProposals.status,
      result: mcpProposals.result,
      errorMessage: mcpProposals.errorMessage,
      expiresAt: mcpProposals.expiresAt,
      confirmedAt: mcpProposals.confirmedAt,
      rejectedAt: mcpProposals.rejectedAt,
      createdAt: mcpProposals.createdAt,
    })
    .from(mcpProposals)
    .where(and(...conditions))
    .orderBy(desc(mcpProposals.createdAt))
    .limit(limit);
}

export async function validateCreateShiftPayload(
  tenantId: number,
  raw: CreateShiftPayload,
): Promise<CreateShiftPayload> {
  if (!raw.title?.trim()) throw new Error("title is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) throw new Error("date must be YYYY-MM-DD");
  if (!raw.startTime?.trim() || !raw.endTime?.trim()) throw new Error("startTime and endTime are required");
  if (!Number.isFinite(raw.siteId)) throw new Error("siteId is required");
  await assertSiteOwned(tenantId, raw.siteId);
  if (raw.employeeId != null) await assertEmployeeOwned(tenantId, raw.employeeId);
  return {
    siteId: raw.siteId,
    title: raw.title.trim().slice(0, 200),
    date: raw.date,
    startTime: raw.startTime.trim().slice(0, 16),
    endTime: raw.endTime.trim().slice(0, 16),
    employeeId: raw.employeeId ?? null,
    supplierId: raw.supplierId ?? null,
    dutyTypeId: raw.dutyTypeId ?? null,
    breakMinutes: raw.breakMinutes ?? 0,
    notes: raw.notes?.trim()?.slice(0, 2000) ?? null,
  };
}
