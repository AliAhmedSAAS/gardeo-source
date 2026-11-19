import { pool } from "./db";
import type { User } from "@shared/schema";

/** Logins that may only see their own records (officers and supplier portal users). */
export const PORTAL_ROLES = ["employee", "supplier"];

export function isPortalRole(role: string | null | undefined): boolean {
  return !!role && PORTAL_ROLES.includes(role);
}

export interface PortalScope {
  /** Shift column that ties a shift to the caller. */
  shiftColumn: "employee_id" | "supplier_id";
  /** Ids the caller owns; empty when no profile is linked (the caller then sees nothing). */
  ids: number[];
}

/** Returns the caller's own-record scope, or null for staff roles that see the whole tenant. */
export async function getPortalScope(user: User): Promise<PortalScope | null> {
  if (!isPortalRole(user.role)) return null;
  const table = user.role === "employee" ? "employees" : "suppliers";
  const { rows } = await pool.query(
    `SELECT id FROM ${table} WHERE user_id = $1 AND tenant_id = $2`,
    [user.id, user.tenantId],
  );
  return {
    shiftColumn: user.role === "employee" ? "employee_id" : "supplier_id",
    ids: rows.map((r: { id: number }) => r.id),
  };
}

/** Ids of sites where the scoped caller has at least one shift. */
export async function getPortalSiteIds(scope: PortalScope, tenantId: number): Promise<number[]> {
  if (scope.ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT site_id FROM shifts
     WHERE tenant_id = $1 AND site_id IS NOT NULL AND ${scope.shiftColumn} = ANY($2::int[])`,
    [tenantId, scope.ids],
  );
  return rows.map((r: { site_id: number }) => r.site_id);
}
