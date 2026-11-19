import { pool } from "./db";

const REFERENCE_TABLES = {
  clientId: "clients",
  siteId: "sites",
  employeeId: "employees",
  supplierId: "suppliers",
} as const;

export type TenantReferenceField = keyof typeof REFERENCE_TABLES;

/**
 * Returns the first referenced field whose id is not a row owned by `tenantId`, or null when all
 * supplied references are valid. Empty values (null, undefined, "") are treated as "not set".
 */
export async function findInvalidTenantReference(
  tenantId: number,
  refs: Partial<Record<TenantReferenceField, unknown>>,
): Promise<TenantReferenceField | null> {
  for (const field of Object.keys(REFERENCE_TABLES) as TenantReferenceField[]) {
    const raw = refs[field];
    if (raw === undefined || raw === null || raw === "") continue;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return field;
    const { rows } = await pool.query(
      `SELECT 1 FROM ${REFERENCE_TABLES[field]} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) return field;
  }
  return null;
}

export function invalidReferenceMessage(field: TenantReferenceField): string {
  const label = field.replace(/Id$/, "");
  return `Invalid ${label}: it does not exist in this organisation`;
}

const ALWAYS_PROTECTED = ["id", "tenantId", "createdAt", "updatedAt", "createdBy"];

/** Removes fields a client must never set directly (ownership, identity, and any extra keys). */
export function omitProtectedFields<T extends Record<string, unknown>>(body: T, extra: string[] = []): T {
  const copy: Record<string, unknown> = { ...body };
  for (const key of [...ALWAYS_PROTECTED, ...extra]) delete copy[key];
  return copy as T;
}
