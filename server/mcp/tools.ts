import { and, eq, gte, ilike, lte, or, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, pool } from "../db";
import { sites, shifts } from "@shared/schema";
import type { McpAuthContext } from "./context";
import { assertScope } from "./context";
import { recordMcpInvocation } from "./audit";
import {
  sanitizeEmployeeSearch,
  sanitizeShift,
  sanitizeSite,
} from "./sanitize";

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
          scopes: ctx.scopes,
          phase: 1,
          tools: [
            "whoami",
            "list_sites",
            "list_shifts",
            "get_shift",
            "get_site_coverage",
            "search_employees",
          ],
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

  return server;
}
