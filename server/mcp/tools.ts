import { and, eq, gte, ilike, lte, or, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, pool } from "../db";
import {
  employees,
  incidents,
  sites,
  shifts,
  suppliers,
} from "@shared/schema";
import type { McpAuthContext } from "./context";
import { assertScope } from "./context";
import { recordMcpInvocation } from "./audit";
import { MCP_DENIED_DOMAINS } from "./deny-list";
import {
  sanitizeAbsence,
  sanitizeEmployeeSearch,
  sanitizeIncident,
  sanitizeShift,
  sanitizeSite,
  sanitizeSupplier,
} from "./sanitize";
import {
  confirmProposal,
  createProposal,
  listProposals,
  rejectProposal,
  validateCreateShiftPayload,
} from "./proposals";

const MAX_PAGE = 50;
const MAX_DATE_RANGE_DAYS = 31;

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: string, to: string): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return Infinity;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

async function withAudit<T>(
  ctx: McpAuthContext,
  toolName: string,
  args: unknown,
  fn: () => Promise<T>,
) {
  const started = Date.now();
  try {
    const data = await fn();
    await recordMcpInvocation(ctx, toolName, args, {
      success: true,
      latencyMs: Date.now() - started,
    });
    return textResult(data);
  } catch (err: any) {
    const message = err?.message || "Tool failed";
    await recordMcpInvocation(ctx, toolName, args, {
      success: false,
      errorMessage: message,
      latencyMs: Date.now() - started,
    });
    return errorResult(message);
  }
}

export function createGardeoMcpServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer({
    name: "gardeo",
    version: "1.0.0",
  });

  server.registerTool(
    "whoami",
    {
      description: "Return the authenticated MCP client identity, tenant, and scopes.",
      inputSchema: {},
    },
    async () =>
      withAudit(ctx, "whoami", {}, async () => {
        assertScope(ctx, "ops.read");
        return {
          tenantId: ctx.tenantId,
          clientId: ctx.clientId,
          clientName: ctx.clientName,
          apiKeyId: ctx.apiKeyId,
          userId: ctx.userId ?? null,
          authType: ctx.authType,
          scopes: ctx.scopes,
          phase: 3,
          tools: [
            "whoami",
            "list_sites",
            "list_shifts",
            "get_shift",
            "get_site_coverage",
            "search_employees",
            "list_open_incidents",
            "list_suppliers",
            "get_compliance_summary",
            "list_today_absences",
            "propose_create_shift",
            "propose_add_handover_note",
            "propose_acknowledge_incident",
            "propose_assign_officer",
            "propose_cancel_shift",
            "propose_book_on",
            "propose_book_off",
            "list_pending_proposals",
            "confirm_proposal",
            "reject_proposal",
          ],
          deniedDomains: MCP_DENIED_DOMAINS,
        };
      }),
  );

  server.registerTool(
    "list_sites",
    {
      description: "List active sites for the authenticated tenant (paginated).",
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
        pageSize: z.number().int().min(1).max(MAX_PAGE).default(25).describe("Page size (max 50)"),
        q: z.string().optional().describe("Optional name/postcode search"),
        includeInactive: z.boolean().optional().describe("Include inactive sites"),
      },
    },
    async (args) =>
      withAudit(ctx, "list_sites", args, async () => {
        assertScope(ctx, "ops.read");
        const page = args.page ?? 1;
        const pageSize = Math.min(args.pageSize ?? 25, MAX_PAGE);
        const offset = (page - 1) * pageSize;

        const conditions = [eq(sites.tenantId, ctx.tenantId)];
        if (!args.includeInactive) conditions.push(eq(sites.isActive, true));
        if (args.q?.trim()) {
          const q = `%${args.q.trim()}%`;
          conditions.push(
            or(ilike(sites.name, q), ilike(sites.postcode, q), ilike(sites.siteCode, q))!,
          );
        }

        const where = and(...conditions);
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(sites)
          .where(where);
        const rows = await db
          .select()
          .from(sites)
          .where(where)
          .orderBy(sites.name)
          .limit(pageSize)
          .offset(offset);

        return {
          page,
          pageSize,
          total: countRow?.count ?? 0,
          data: rows.map((r) => sanitizeSite(r as unknown as Record<string, unknown>)),
        };
      }),
  );

  server.registerTool(
    "list_shifts",
    {
      description:
        "List shifts for a date range (max 31 days). Always scoped to the authenticated tenant.",
      inputSchema: {
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
        siteId: z.number().int().optional(),
        supplierId: z.number().int().optional(),
        status: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE).default(25),
      },
    },
    async (args) =>
      withAudit(ctx, "list_shifts", args, async () => {
        assertScope(ctx, "ops.read");
        if (!parseDateOnly(args.from) || !parseDateOnly(args.to)) {
          throw new Error("from/to must be YYYY-MM-DD");
        }
        if (daysBetween(args.from, args.to) > MAX_DATE_RANGE_DAYS) {
          throw new Error(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
        }
        if (args.from > args.to) throw new Error("from must be on or before to");

        const page = args.page ?? 1;
        const pageSize = Math.min(args.pageSize ?? 25, MAX_PAGE);
        const offset = (page - 1) * pageSize;

        const conditions = [
          eq(shifts.tenantId, ctx.tenantId),
          gte(shifts.date, args.from),
          lte(shifts.date, args.to),
        ];
        if (args.siteId != null) conditions.push(eq(shifts.siteId, args.siteId));
        if (args.supplierId != null) conditions.push(eq(shifts.supplierId, args.supplierId));
        if (args.status) conditions.push(eq(shifts.status, args.status as any));

        const where = and(...conditions);
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(shifts)
          .where(where);
        const rows = await db
          .select()
          .from(shifts)
          .where(where)
          .orderBy(desc(shifts.date), shifts.startTime)
          .limit(pageSize)
          .offset(offset);

        return {
          page,
          pageSize,
          total: countRow?.count ?? 0,
          from: args.from,
          to: args.to,
          data: rows.map((r) => sanitizeShift(r as unknown as Record<string, unknown>)),
        };
      }),
  );

  server.registerTool(
    "get_shift",
    {
      description: "Get one shift by id (tenant-scoped).",
      inputSchema: {
        shiftId: z.number().int().describe("Shift id"),
      },
    },
    async (args) =>
      withAudit(ctx, "get_shift", args, async () => {
        assertScope(ctx, "ops.read");
        const [row] = await db
          .select()
          .from(shifts)
          .where(and(eq(shifts.id, args.shiftId), eq(shifts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!row) throw new Error("Shift not found");
        return sanitizeShift(row as unknown as Record<string, unknown>);
      }),
  );

  server.registerTool(
    "get_site_coverage",
    {
      description:
        "Coverage summary for a date: sites with scheduled shifts, booked-on counts, and gaps.",
      inputSchema: {
        date: z.string().describe("Date YYYY-MM-DD"),
      },
    },
    async (args) =>
      withAudit(ctx, "get_site_coverage", args, async () => {
        assertScope(ctx, "ops.read");
        if (!parseDateOnly(args.date)) throw new Error("date must be YYYY-MM-DD");

        const { rows } = await pool.query(
          `SELECT
             s.id AS site_id,
             s.site_code,
             s.name AS site_name,
             COUNT(sh.id)::int AS total_shifts,
             COUNT(sh.id) FILTER (WHERE sh.booked_on_at IS NOT NULL)::int AS booked_on,
             COUNT(sh.id) FILTER (WHERE sh.status = 'cancelled')::int AS cancelled,
             COUNT(sh.id) FILTER (
               WHERE sh.booked_on_at IS NULL
                 AND sh.status IS DISTINCT FROM 'cancelled'
             )::int AS not_booked_on
           FROM sites s
           LEFT JOIN shifts sh
             ON sh.site_id = s.id
            AND sh.tenant_id = s.tenant_id
            AND sh.date = $2
           WHERE s.tenant_id = $1
             AND COALESCE(s.is_active, true) = true
           GROUP BY s.id, s.site_code, s.name
           HAVING COUNT(sh.id) > 0
           ORDER BY s.name`,
          [ctx.tenantId, args.date],
        );

        const totals = rows.reduce(
          (acc, r) => {
            acc.totalShifts += r.total_shifts;
            acc.bookedOn += r.booked_on;
            acc.notBookedOn += r.not_booked_on;
            acc.cancelled += r.cancelled;
            return acc;
          },
          { totalShifts: 0, bookedOn: 0, notBookedOn: 0, cancelled: 0 },
        );

        return {
          date: args.date,
          summary: {
            ...totals,
            coverageRate:
              totals.totalShifts - totals.cancelled > 0
                ? Math.round(
                    (totals.bookedOn / (totals.totalShifts - totals.cancelled)) * 1000,
                  ) / 10
                : null,
          },
          sites: rows.map((r) => ({
            siteId: r.site_id,
            siteCode: r.site_code,
            siteName: r.site_name,
            totalShifts: r.total_shifts,
            bookedOn: r.booked_on,
            notBookedOn: r.not_booked_on,
            cancelled: r.cancelled,
          })),
        };
      }),
  );

  server.registerTool(
    "search_employees",
    {
      description:
        "Search employees by name or employee number. Returns sanitized fields only (no NI/bank/address).",
      inputSchema: {
        q: z.string().min(1).describe("Search query"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE).default(25),
      },
    },
    async (args) =>
      withAudit(ctx, "search_employees", args, async () => {
        assertScope(ctx, "ops.read");
        const page = args.page ?? 1;
        const pageSize = Math.min(args.pageSize ?? 25, MAX_PAGE);
        const offset = (page - 1) * pageSize;
        const q = `%${args.q.trim()}%`;

        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM employees e
           LEFT JOIN users u ON u.id = e.user_id
           WHERE e.tenant_id = $1
             AND COALESCE(e.is_merged, false) = false
             AND (
               e.employee_number ILIKE $2
               OR u.first_name ILIKE $2
               OR u.last_name ILIKE $2
               OR CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) ILIKE $2
             )`,
          [ctx.tenantId, q],
        );

        const { rows } = await pool.query(
          `SELECT e.id, e.employee_number, e.job_title, e.department, e.supplier_id,
                  e.sia_expiry_date, u.first_name, u.last_name, u.is_active
           FROM employees e
           LEFT JOIN users u ON u.id = e.user_id
           WHERE e.tenant_id = $1
             AND COALESCE(e.is_merged, false) = false
             AND (
               e.employee_number ILIKE $2
               OR u.first_name ILIKE $2
               OR u.last_name ILIKE $2
               OR CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) ILIKE $2
             )
           ORDER BY u.last_name NULLS LAST, u.first_name NULLS LAST, e.id
           LIMIT $3 OFFSET $4`,
          [ctx.tenantId, q, pageSize, offset],
        );

        return {
          page,
          pageSize,
          total: countRows[0]?.count ?? 0,
          data: rows.map((r) => sanitizeEmployeeSearch(r)),
        };
      }),
  );

  server.registerTool(
    "propose_create_shift",
    {
      description:
        "Propose creating a scheduled shift. Does NOT write until confirm_proposal (or admin UI approve). Requires ops.write.",
      inputSchema: {
        siteId: z.number().int(),
        title: z.string().min(1).max(200),
        date: z.string().describe("YYYY-MM-DD"),
        startTime: z.string().describe("HH:MM"),
        endTime: z.string().describe("HH:MM"),
        employeeId: z.number().int().optional(),
        supplierId: z.number().int().optional(),
        dutyTypeId: z.number().int().optional(),
        breakMinutes: z.number().int().min(0).max(240).optional(),
        notes: z.string().max(2000).optional(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_create_shift", args, async () => {
        assertScope(ctx, "ops.write");
        const payload = await validateCreateShiftPayload(ctx.tenantId, {
          siteId: args.siteId,
          title: args.title,
          date: args.date,
          startTime: args.startTime,
          endTime: args.endTime,
          employeeId: args.employeeId,
          supplierId: args.supplierId,
          dutyTypeId: args.dutyTypeId,
          breakMinutes: args.breakMinutes,
          notes: args.notes,
        });
        const summary = `Create shift "${payload.title}" at site ${payload.siteId} on ${payload.date} ${payload.startTime}-${payload.endTime}`;
        const { proposal, confirmToken } = await createProposal(
          ctx,
          "create_shift",
          payload as unknown as Record<string, unknown>,
          summary,
        );
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
          note: "Call confirm_proposal with proposalId + confirmToken to apply, or approve in Settings → MCP.",
        };
      }),
  );

  server.registerTool(
    "propose_add_handover_note",
    {
      description:
        "Propose adding a handover note to a shift. Requires confirm_proposal. Requires ops.write.",
      inputSchema: {
        shiftId: z.number().int(),
        note: z.string().min(1).max(2000),
        mode: z.enum(["append", "replace"]).optional().describe("Default append"),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_add_handover_note", args, async () => {
        assertScope(ctx, "ops.write");
        const shift = await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(and(eq(shifts.id, args.shiftId), eq(shifts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!shift[0]) throw new Error("Shift not found");
        const payload = {
          shiftId: args.shiftId,
          note: args.note.trim(),
          mode: args.mode === "replace" ? "replace" : "append",
        };
        const summary = `Add handover note on shift ${args.shiftId} (${payload.mode})`;
        const { proposal, confirmToken } = await createProposal(
          ctx,
          "add_handover_note",
          payload,
          summary,
        );
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  server.registerTool(
    "propose_acknowledge_incident",
    {
      description:
        "Propose acknowledging an incident (status → investigating). Requires confirm_proposal. Requires ops.write.",
      inputSchema: {
        incidentId: z.number().int(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_acknowledge_incident", args, async () => {
        assertScope(ctx, "ops.write");
        const [incident] = await db
          .select({
            id: incidents.id,
            title: incidents.title,
            status: incidents.status,
          })
          .from(incidents)
          .where(and(eq(incidents.id, args.incidentId), eq(incidents.tenantId, ctx.tenantId)))
          .limit(1);
        if (!incident) throw new Error("Incident not found");
        if (incident.status !== "reported" && incident.status !== "investigating") {
          throw new Error(`Cannot acknowledge incident with status '${incident.status}'`);
        }
        const payload = { incidentId: args.incidentId };
        const summary = `Acknowledge incident #${incident.id}: ${incident.title}`;
        const { proposal, confirmToken } = await createProposal(
          ctx,
          "acknowledge_incident",
          payload,
          summary,
        );
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  server.registerTool(
    "list_pending_proposals",
    {
      description: "List pending MCP write proposals for this client/tenant.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async (args) =>
      withAudit(ctx, "list_pending_proposals", args, async () => {
        assertScope(ctx, "ops.write");
        const rows = await listProposals(ctx.tenantId, {
          status: "pending",
          limit: args.limit ?? 25,
          clientId: ctx.clientId ?? undefined,
        });
        return {
          data: rows.map((r) => ({
            id: r.id,
            proposalType: r.proposalType,
            summary: r.summary,
            status: r.status,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
          })),
        };
      }),
  );

  server.registerTool(
    "confirm_proposal",
    {
      description:
        "Confirm a pending proposal using the one-time confirmToken returned by propose_* tools. Requires ops.write.",
      inputSchema: {
        proposalId: z.number().int(),
        confirmToken: z.string().min(10),
      },
    },
    async (args) =>
      withAudit(ctx, "confirm_proposal", args, async () => {
        assertScope(ctx, "ops.write");
        const { proposal, result } = await confirmProposal({
          tenantId: ctx.tenantId,
          proposalId: args.proposalId,
          confirmToken: args.confirmToken,
          requireToken: true,
          clientId: ctx.clientId,
          ipAddress: ctx.ipAddress,
        });
        return {
          status: proposal.status,
          proposalId: proposal.id,
          proposalType: proposal.proposalType,
          result,
        };
      }),
  );

  server.registerTool(
    "reject_proposal",
    {
      description: "Reject a pending proposal. Requires ops.write and confirmToken.",
      inputSchema: {
        proposalId: z.number().int(),
        confirmToken: z.string().min(10),
      },
    },
    async (args) =>
      withAudit(ctx, "reject_proposal", args, async () => {
        assertScope(ctx, "ops.write");
        const proposal = await rejectProposal({
          tenantId: ctx.tenantId,
          proposalId: args.proposalId,
          confirmToken: args.confirmToken,
          requireToken: true,
          clientId: ctx.clientId,
          ipAddress: ctx.ipAddress,
        });
        return {
          status: proposal.status,
          proposalId: proposal.id,
          proposalType: proposal.proposalType,
        };
      }),
  );

  // ─── Phase 3 reads ───────────────────────────────────────────────

  server.registerTool(
    "list_open_incidents",
    {
      description: "List open/investigating incidents for the tenant (sanitized).",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE).default(25),
      },
    },
    async (args) =>
      withAudit(ctx, "list_open_incidents", args, async () => {
        assertScope(ctx, "ops.read");
        const page = args.page ?? 1;
        const pageSize = Math.min(args.pageSize ?? 25, MAX_PAGE);
        const offset = (page - 1) * pageSize;
        const where = and(
          eq(incidents.tenantId, ctx.tenantId),
          or(eq(incidents.status, "reported"), eq(incidents.status, "investigating")),
        );
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(incidents)
          .where(where);
        const rows = await db
          .select()
          .from(incidents)
          .where(where)
          .orderBy(desc(incidents.incidentDate), desc(incidents.id))
          .limit(pageSize)
          .offset(offset);
        return {
          page,
          pageSize,
          total: countRow?.count ?? 0,
          data: rows.map((r) => sanitizeIncident(r as unknown as Record<string, unknown>)),
        };
      }),
  );

  server.registerTool(
    "list_suppliers",
    {
      description: "List suppliers for the tenant (no bank/VAT/finance fields).",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(MAX_PAGE).default(25),
        q: z.string().optional(),
        status: z.string().optional(),
      },
    },
    async (args) =>
      withAudit(ctx, "list_suppliers", args, async () => {
        assertScope(ctx, "ops.read");
        const page = args.page ?? 1;
        const pageSize = Math.min(args.pageSize ?? 25, MAX_PAGE);
        const offset = (page - 1) * pageSize;
        const conditions = [eq(suppliers.tenantId, ctx.tenantId)];
        if (args.status) conditions.push(eq(suppliers.status, args.status as any));
        if (args.q?.trim()) {
          const q = `%${args.q.trim()}%`;
          conditions.push(
            or(ilike(suppliers.companyName, q), ilike(suppliers.supplierCode, q))!,
          );
        }
        const where = and(...conditions);
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(suppliers)
          .where(where);
        const rows = await db
          .select()
          .from(suppliers)
          .where(where)
          .orderBy(suppliers.companyName)
          .limit(pageSize)
          .offset(offset);
        return {
          page,
          pageSize,
          total: countRow?.count ?? 0,
          data: rows.map((r) => sanitizeSupplier(r as unknown as Record<string, unknown>)),
        };
      }),
  );

  server.registerTool(
    "get_compliance_summary",
    {
      description:
        "Aggregated SIA/DBS/first-aid expiry bands for active employees. No licence numbers returned.",
      inputSchema: {},
    },
    async () =>
      withAudit(ctx, "get_compliance_summary", {}, async () => {
        assertScope(ctx, "ops.read");
        const { rows } = await pool.query(
          `SELECT
             COUNT(*)::int AS total_employees,
             COUNT(*) FILTER (
               WHERE e.sia_expiry_date IS NOT NULL
                 AND e.sia_expiry_date::date < CURRENT_DATE
             )::int AS sia_expired,
             COUNT(*) FILTER (
               WHERE e.sia_expiry_date IS NOT NULL
                 AND e.sia_expiry_date::date >= CURRENT_DATE
                 AND e.sia_expiry_date::date < CURRENT_DATE + INTERVAL '30 days'
             )::int AS sia_within_30,
             COUNT(*) FILTER (
               WHERE e.sia_expiry_date IS NOT NULL
                 AND e.sia_expiry_date::date >= CURRENT_DATE + INTERVAL '30 days'
                 AND e.sia_expiry_date::date < CURRENT_DATE + INTERVAL '90 days'
             )::int AS sia_within_90,
             COUNT(*) FILTER (
               WHERE e.dbs_issue_date IS NULL
             )::int AS dbs_missing,
             COUNT(*) FILTER (
               WHERE e.has_first_aid = true
                 AND e.first_aid_expiry IS NOT NULL
                 AND e.first_aid_expiry::date < CURRENT_DATE
             )::int AS first_aid_expired
           FROM employees e
           LEFT JOIN users u ON u.id = e.user_id
           WHERE e.tenant_id = $1
             AND COALESCE(e.is_merged, false) = false
             AND COALESCE(u.is_active, true) = true`,
          [ctx.tenantId],
        );
        return { summary: rows[0] || {} };
      }),
  );

  server.registerTool(
    "list_today_absences",
    {
      description:
        "Open absences and approved leave overlapping a date (default today). No fit-note/reason text.",
      inputSchema: {
        date: z.string().optional().describe("YYYY-MM-DD, default today (UTC)"),
      },
    },
    async (args) =>
      withAudit(ctx, "list_today_absences", args, async () => {
        assertScope(ctx, "ops.read");
        const date =
          args.date && parseDateOnly(args.date)
            ? args.date
            : new Date().toISOString().slice(0, 10);

        const { rows: absRows } = await pool.query(
          `SELECT a.id, a.employee_id, a.absence_type AS type, a.start_date, a.end_date, a.status,
                  e.employee_number, u.first_name, u.last_name, 'absence' AS kind
           FROM absence_records a
           JOIN employees e ON e.id = a.employee_id
           LEFT JOIN users u ON u.id = e.user_id
           WHERE a.tenant_id = $1
             AND a.status = 'open'
             AND a.start_date <= $2::date
             AND (a.end_date IS NULL OR a.end_date >= $2::date)
           ORDER BY a.start_date, a.id`,
          [ctx.tenantId, date],
        );

        const { rows: leaveRows } = await pool.query(
          `SELECT t.id, t.employee_id, t.leave_type AS type, t.start_date, t.end_date, t.status,
                  e.employee_number, u.first_name, u.last_name, 'leave' AS kind
           FROM time_off_requests t
           JOIN employees e ON e.id = t.employee_id
           LEFT JOIN users u ON u.id = e.user_id
           WHERE t.tenant_id = $1
             AND t.status = 'approved'
             AND t.start_date <= $2::date
             AND t.end_date >= $2::date
           ORDER BY t.start_date, t.id`,
          [ctx.tenantId, date],
        );

        return {
          date,
          absences: absRows.map((r) => sanitizeAbsence(r)),
          leave: leaveRows.map((r) => sanitizeAbsence(r)),
          totals: {
            absences: absRows.length,
            leave: leaveRows.length,
          },
        };
      }),
  );

  // ─── Phase 3 write proposals ─────────────────────────────────────

  server.registerTool(
    "propose_assign_officer",
    {
      description: "Propose assigning an employee to a shift. Requires confirm_proposal + ops.write.",
      inputSchema: {
        shiftId: z.number().int(),
        employeeId: z.number().int(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_assign_officer", args, async () => {
        assertScope(ctx, "ops.write");
        const shift = await storageGetShift(ctx.tenantId, args.shiftId);
        const emp = await db
          .select({ id: employees.id })
          .from(employees)
          .where(and(eq(employees.id, args.employeeId), eq(employees.tenantId, ctx.tenantId)))
          .limit(1);
        if (!emp[0]) throw new Error("Employee not found");
        const payload = { shiftId: args.shiftId, employeeId: args.employeeId };
        const summary = `Assign employee ${args.employeeId} to shift ${args.shiftId} (${shift.title})`;
        const { proposal, confirmToken } = await createProposal(ctx, "assign_officer", payload, summary);
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  server.registerTool(
    "propose_cancel_shift",
    {
      description: "Propose cancelling a shift. Requires confirm_proposal + ops.write.",
      inputSchema: {
        shiftId: z.number().int(),
        reason: z.string().max(500).optional(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_cancel_shift", args, async () => {
        assertScope(ctx, "ops.write");
        const shift = await storageGetShift(ctx.tenantId, args.shiftId);
        if (shift.status === "cancelled") throw new Error("Shift is already cancelled");
        const payload = { shiftId: args.shiftId, reason: args.reason?.trim() || null };
        const summary = `Cancel shift ${args.shiftId} (${shift.title} on ${shift.date})`;
        const { proposal, confirmToken } = await createProposal(ctx, "cancel_shift", payload, summary);
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  server.registerTool(
    "propose_book_on",
    {
      description: "Propose booking on a scheduled shift. Requires confirm_proposal + ops.write.",
      inputSchema: {
        shiftId: z.number().int(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_book_on", args, async () => {
        assertScope(ctx, "ops.write");
        const shift = await storageGetShift(ctx.tenantId, args.shiftId);
        if (shift.status !== "scheduled") {
          throw new Error(`Cannot book on a shift with status '${shift.status}'`);
        }
        const payload = { shiftId: args.shiftId };
        const summary = `Book on shift ${args.shiftId} (${shift.title})`;
        const { proposal, confirmToken } = await createProposal(ctx, "book_on", payload, summary);
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  server.registerTool(
    "propose_book_off",
    {
      description:
        "Propose booking off a booked_on/in_progress shift, optional handover note. Requires confirm_proposal + ops.write.",
      inputSchema: {
        shiftId: z.number().int(),
        handoverNote: z.string().max(2000).optional(),
      },
    },
    async (args) =>
      withAudit(ctx, "propose_book_off", args, async () => {
        assertScope(ctx, "ops.write");
        const shift = await storageGetShift(ctx.tenantId, args.shiftId);
        if (shift.status !== "booked_on" && shift.status !== "in_progress") {
          throw new Error(`Cannot book off a shift with status '${shift.status}'`);
        }
        const payload = {
          shiftId: args.shiftId,
          handoverNote: args.handoverNote?.trim() || null,
        };
        const summary = `Book off shift ${args.shiftId} (${shift.title})`;
        const { proposal, confirmToken } = await createProposal(ctx, "book_off", payload, summary);
        return {
          status: "pending_confirmation",
          proposalId: proposal.id,
          confirmToken,
          expiresAt: proposal.expiresAt,
          summary,
        };
      }),
  );

  return server;
}

async function storageGetShift(tenantId: number, shiftId: number) {
  const [shift] = await db
    .select({
      id: shifts.id,
      title: shifts.title,
      date: shifts.date,
      status: shifts.status,
    })
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId)))
    .limit(1);
  if (!shift) throw new Error("Shift not found");
  return shift;
}
