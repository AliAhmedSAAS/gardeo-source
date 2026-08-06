import { pool } from "./db";
import { findFuzzySiteMatches, normalizeSiteName } from "./dedup-utils";

export function sanitizeDate(value: any): string | null {
  if (!value || value === "" || value === "0000-00-00") return null;
  const str = String(value).trim();
  if (str.startsWith("-") || str.startsWith("0000")) return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;
  return str;
}

export interface EntitySyncResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface EntityBreakdown {
  [entityType: string]: EntitySyncResult;
}

export function newEntitySyncResult(): EntitySyncResult {
  return { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
}

export function mergeResults(breakdown: EntityBreakdown): { totalCreated: number; totalUpdated: number; totalSkipped: number; totalFailed: number; allErrors: string[] } {
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalFailed = 0;
  const allErrors: string[] = [];
  for (const [type, r] of Object.entries(breakdown)) {
    totalCreated += r.created;
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalFailed += r.failed;
    allErrors.push(...r.errors.map(e => `[${type}] ${e}`));
  }
  return { totalCreated, totalUpdated, totalSkipped, totalFailed, allErrors };
}

export async function findByExternalId(tenantId: number, table: string, extId: string): Promise<any | null> {
  const res = await pool.query(
    `SELECT * FROM ${table} WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  return res.rows[0] || null;
}

export async function findClientByNameOrExtId(tenantId: number, extId: string, companyName: string): Promise<any | null> {
  const byExt = await pool.query(
    `SELECT * FROM clients WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExt.rows.length > 0) return byExt.rows[0];

  if (!companyName) return null;
  const normalizedIncoming = normalizeSiteName(companyName);
  const allClients = await pool.query(`SELECT * FROM clients WHERE tenant_id = $1`, [tenantId]);
  return allClients.rows.find((c: any) => {
    const norm = normalizeSiteName(c.company_name);
    return norm === normalizedIncoming ||
      c.company_name.toLowerCase().trim() === companyName.toLowerCase().trim() ||
      (norm.length >= 5 && (norm.startsWith(normalizedIncoming) || normalizedIncoming.startsWith(norm)));
  }) || null;
}

export async function findSupplierByNameOrExtId(tenantId: number, extId: string, companyName: string): Promise<any | null> {
  const res = await pool.query(
    `SELECT * FROM suppliers WHERE tenant_id = $1 AND (
      external_id = $2
      OR LOWER(company_name) = LOWER($3)
      OR (LENGTH(company_name) >= 5 AND LOWER(REPLACE($3, '&', 'and')) LIKE LOWER(REPLACE(company_name, '&', 'and')) || '%')
      OR (LENGTH($3) >= 5 AND LOWER(REPLACE(company_name, '&', 'and')) LIKE LOWER(REPLACE($3, '&', 'and')) || '%')
    ) LIMIT 1`,
    [tenantId, extId, companyName || ""]
  );
  return res.rows[0] || null;
}

export async function findSiteByExtIdOrFuzzy(
  tenantId: number,
  extId: string,
  name: string,
  siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>
): Promise<{ row: any | null; fuzzyMatches?: Array<{ siteId: number; siteName: string; matchReason: string; score: number }> }> {
  const byExt = await pool.query(
    `SELECT * FROM sites WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExt.rows.length > 0) return { row: byExt.rows[0] };

  if (!name) return { row: null };

  const decision = siteDecisions?.[name] || siteDecisions?.[name.toLowerCase()];
  if (decision?.action === "use_existing" && decision.siteId) {
    const r = await pool.query(`SELECT * FROM sites WHERE id = $1 LIMIT 1`, [decision.siteId]);
    return { row: r.rows[0] || null };
  }
  if (decision?.action === "create_new") {
    return { row: null };
  }

  const allSites = await pool.query(`SELECT id, name, postcode FROM sites WHERE tenant_id = $1`, [tenantId]);
  const fuzzyMatches = findFuzzySiteMatches(name, allSites.rows);
  if (fuzzyMatches.length > 0) {
    const r = await pool.query(`SELECT * FROM sites WHERE id = $1 LIMIT 1`, [fuzzyMatches[0].siteId]);
    return {
      row: r.rows[0] || null,
      fuzzyMatches: fuzzyMatches.map(m => ({ siteId: m.siteId, siteName: m.siteName, matchReason: m.matchReason, score: m.score }))
    };
  }

  return { row: null };
}

export async function findEmployeeByExtIdOrName(tenantId: number, extId: string, firstName: string, lastName: string, email?: string): Promise<{ userId: string | null; empId: number | null }> {
  const byExt = await pool.query(
    `SELECT user_id, id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExt.rows.length > 0) return { userId: byExt.rows[0].user_id, empId: byExt.rows[0].id };

  if (email) {
    const byEmail = await pool.query(
      `SELECT u.id as user_id, e.id as emp_id FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.tenant_id = $1 AND LOWER(u.email) = LOWER($2) LIMIT 1`,
      [tenantId, email]
    );
    if (byEmail.rows.length > 0) return { userId: byEmail.rows[0].user_id, empId: byEmail.rows[0].emp_id };
  }

  if (firstName && lastName) {
    const byName = await pool.query(
      `SELECT u.id as user_id, e.id as emp_id FROM users u JOIN employees e ON e.user_id = u.id WHERE u.tenant_id = $1 AND LOWER(u.first_name) = LOWER($2) AND LOWER(u.last_name) = LOWER($3) LIMIT 1`,
      [tenantId, firstName.trim(), lastName.trim()]
    );
    if (byName.rows.length > 0) return { userId: byName.rows[0].user_id, empId: byName.rows[0].emp_id };
  }

  return { userId: null, empId: null };
}

export function buildFillBlanksUpdate(
  table: string,
  fieldMap: Record<string, { dbField: string; value: any }>,
  alwaysSetFields: Record<string, any>,
  whereId: number | string,
  whereColumn: string = "id"
): { sql: string; values: any[]; hasFieldUpdates: boolean } | null {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;
  let fieldUpdateCount = 0;

  for (const [, { dbField, value }] of Object.entries(fieldMap)) {
    if (value !== null && value !== undefined && value !== "") {
      updates.push(`${dbField} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
      fieldUpdateCount++;
    }
  }

  for (const [dbField, value] of Object.entries(alwaysSetFields)) {
    if (value !== null && value !== undefined) {
      updates.push(`${dbField} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
    }
  }

  updates.push(`last_synced_at = NOW()`);

  if (updates.length === 1) return null;

  values.push(whereId);
  const sql = `UPDATE ${table} SET ${updates.join(", ")} WHERE ${whereColumn} = $${paramIdx}`;
  return { sql, values, hasFieldUpdates: fieldUpdateCount > 0 };
}

export async function upsertClient(
  tenantId: number,
  extId: string,
  data: Record<string, any>,
  result: EntitySyncResult
): Promise<number | null> {
  try {
    const existing = await findClientByNameOrExtId(tenantId, extId, data.companyName);

    if (existing) {
      const update = buildFillBlanksUpdate("clients", {
        contactName: { dbField: "contact_name", value: data.contactName },
        contactEmail: { dbField: "contact_email", value: data.contactEmail },
        contactPhone: { dbField: "contact_phone", value: data.contactPhone },
        address: { dbField: "address", value: data.address },
        postcode: { dbField: "postcode", value: data.postcode },
        companyRegNumber: { dbField: "company_reg_number", value: data.companyRegNumber },
        contractRef: { dbField: "contract_ref", value: data.contractRef },
      }, { external_id: extId }, existing.id);

      if (update) {
        await pool.query(update.sql, update.values);
        if (update.hasFieldUpdates) {
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await pool.query(`UPDATE clients SET last_synced_at = NOW() WHERE id = $1`, [existing.id]);
        result.skipped++;
      }
      return existing.id;
    }

    const ins = await pool.query(
      `INSERT INTO clients (tenant_id, company_name, contact_name, contact_email, contact_phone, address, postcode, company_reg_number, contract_ref, external_id, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [tenantId, data.companyName || data.name, data.contactName || null, data.contactEmail || null, data.contactPhone || null,
       data.address || null, data.postcode || null, data.companyRegNumber || null, data.contractRef || null, extId]
    );
    result.created++;
    return ins.rows[0]?.id || null;
  } catch (err: any) {
    result.failed++;
    result.errors.push(`Client ${data.companyName || extId}: ${err.message}`);
    return null;
  }
}

export async function upsertSupplier(
  tenantId: number,
  extId: string,
  data: Record<string, any>,
  result: EntitySyncResult
): Promise<number | null> {
  try {
    const existing = await findSupplierByNameOrExtId(tenantId, extId, data.companyName);

    if (existing) {
      const update = buildFillBlanksUpdate("suppliers", {
        contactName: { dbField: "contact_name", value: data.contactName || data.contact_name || null },
        email: { dbField: "email", value: data.email },
        phone: { dbField: "phone", value: data.phone },
        vatNumber: { dbField: "vat_number", value: data.vatNumber },
        companyRegNumber: { dbField: "company_reg_number", value: data.companyRegNumber },
        address: { dbField: "address", value: data.address },
        postcode: { dbField: "postcode", value: data.postcode },
        bankName: { dbField: "bank_name", value: data.bankName },
        accountName: { dbField: "account_name", value: data.accountName },
        accountNumber: { dbField: "account_number", value: data.accountNumber },
        sortCode: { dbField: "sort_code", value: data.sortCode },
      }, { external_id: extId }, existing.id);

      if (update) {
        await pool.query(update.sql, update.values);
        if (update.hasFieldUpdates) {
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await pool.query(`UPDATE suppliers SET last_synced_at = NOW() WHERE id = $1`, [existing.id]);
        result.skipped++;
      }
      return existing.id;
    }

    const ins = await pool.query(
      `INSERT INTO suppliers (tenant_id, company_name, contact_name, email, phone, supplier_type, vat_number, company_reg_number, address, postcode, bank_name, account_name, account_number, sort_code, external_id, status, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', NOW()) RETURNING id`,
      [tenantId, data.companyName, data.contactName || data.contact_name || null, data.email || `supplier-${extId}@placeholder.local`, data.phone || null,
       data.supplierType || "labour", data.vatNumber || null, data.companyRegNumber || null,
       data.address || null, data.postcode || null, data.bankName || null, data.accountName || null,
       data.accountNumber || null, data.sortCode || null, extId]
    );
    result.created++;
    return ins.rows[0]?.id || null;
  } catch (err: any) {
    result.failed++;
    result.errors.push(`Supplier ${data.companyName || extId}: ${err.message}`);
    return null;
  }
}

export async function upsertSite(
  tenantId: number,
  extId: string,
  data: Record<string, any>,
  clientId: number | null,
  result: EntitySyncResult,
  siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>
): Promise<number | null> {
  try {
    const { row: existing } = await findSiteByExtIdOrFuzzy(tenantId, extId, data.name, siteDecisions);

    if (existing) {
      const update = buildFillBlanksUpdate("sites", {
        address: { dbField: "address", value: data.address },
        city: { dbField: "city", value: data.city },
        postcode: { dbField: "postcode", value: data.postcode },
        latitude: { dbField: "latitude", value: data.latitude ? String(data.latitude) : null },
        longitude: { dbField: "longitude", value: data.longitude ? String(data.longitude) : null },
        contractRef: { dbField: "contract_ref", value: data.contractRef },
        clientId: { dbField: "client_id", value: clientId },
      }, { external_id: extId }, existing.id);

      if (update) {
        await pool.query(update.sql, update.values);
        if (update.hasFieldUpdates) {
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await pool.query(`UPDATE sites SET last_synced_at = NOW() WHERE id = $1`, [existing.id]);
        result.skipped++;
      }
      return existing.id;
    }

    const ins = await pool.query(
      `INSERT INTO sites (tenant_id, name, address, city, postcode, latitude, longitude, client_id, contract_ref, external_id, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [tenantId, data.name, data.address || data.name, data.city || null, data.postcode || null,
       data.latitude ? String(data.latitude) : null, data.longitude ? String(data.longitude) : null,
       clientId, data.contractRef || null, extId]
    );
    result.created++;
    return ins.rows[0]?.id || null;
  } catch (err: any) {
    result.failed++;
    result.errors.push(`Site ${data.name || extId}: ${err.message}`);
    return null;
  }
}

export async function upsertEmployee(
  tenantId: number,
  extId: string,
  data: Record<string, any>,
  supplierId: number | null,
  result: EntitySyncResult
): Promise<{ userId: string | null; empId: number | null }> {
  const firstName = data.firstName || (data.fullName ? data.fullName.trim().split(/\s+/)[0] : null) || (data.employeeName ? data.employeeName.trim().split(/\s+/)[0] : null);
  const lastName = data.lastName || (data.fullName ? data.fullName.trim().split(/\s+/).slice(1).join(" ") : null) || (data.employeeName ? data.employeeName.trim().split(/\s+/).slice(1).join(" ") : null);
  const email = (data.email || data.employeeEmail || "").toLowerCase().trim();
  try {

    if (!firstName || !lastName) {
      result.skipped++;
      return { userId: null, empId: null };
    }

    const existing = await findEmployeeByExtIdOrName(tenantId, extId, firstName, lastName, email || undefined);

    if (existing.userId) {
      if (data.phone || data.telephone) {
        await pool.query(
          `UPDATE users SET phone = $1 WHERE id = $2`,
          [data.phone || data.telephone, existing.userId]
        );
      }

      if (email) {
        await pool.query(
          `UPDATE users SET email = $1, username = $1 WHERE id = $2`,
          [email, existing.userId]
        );
      }

      if (existing.empId) {
        const update = buildFillBlanksUpdate("employees", {
          dateOfBirth: { dbField: "date_of_birth", value: sanitizeDate(data.dateOfBirth || data.dob) },
          nationalInsurance: { dbField: "national_insurance", value: data.nationalInsurance || data.ni_number },
          addressLine1: { dbField: "address_line_1", value: data.addressLine1 || data.add1 },
          addressLine2: { dbField: "address_line_2", value: data.addressLine2 || data.add2 },
          city: { dbField: "city", value: data.city },
          county: { dbField: "county", value: data.county },
          postcode: { dbField: "postcode", value: data.postcode },
          gender: { dbField: "gender", value: data.gender },
          nationality: { dbField: "nationality", value: data.nationality },
          jobTitle: { dbField: "job_title", value: data.jobTitle },
          siaLicenseNumber: { dbField: "sia_license_number", value: data.siaLicenseNumber || data.sia },
          siaExpiryDate: { dbField: "sia_expiry_date", value: sanitizeDate(data.siaExpiryDate || data.siaexp) },
          dbsCertificateNumber: { dbField: "dbs_certificate_number", value: data.dbsCertificateNumber },
          employeeNumber: { dbField: "employee_number", value: data.employeeNumber },
          placeOfBirth: { dbField: "place_of_birth", value: data.placeOfBirth || data.place_of_birth },
          supplierId: { dbField: "supplier_id", value: supplierId },
        }, { external_id: extId }, existing.empId);

        if (update) {
          await pool.query(update.sql, update.values);
          if (update.hasFieldUpdates) {
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          await pool.query(`UPDATE employees SET last_synced_at = NOW() WHERE id = $1`, [existing.empId]);
          result.skipped++;
        }
        return existing;
      } else {
        const empResult = await pool.query(
          `INSERT INTO employees (user_id, tenant_id, date_of_birth, national_insurance, address_line_1, address_line_2, city, county, postcode, gender, nationality, job_title, sia_license_number, sia_expiry_date, dbs_certificate_number, employee_number, place_of_birth, supplier_id, external_id, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW()) RETURNING id`,
          [existing.userId, tenantId, sanitizeDate(data.dateOfBirth || data.dob), data.nationalInsurance || data.ni_number || null,
           data.addressLine1 || data.add1 || null, data.addressLine2 || data.add2 || null,
           data.city || null, data.county || null, data.postcode || null,
           data.gender || null, data.nationality || null,
           data.jobTitle || null, data.siaLicenseNumber || data.sia || null, sanitizeDate(data.siaExpiryDate || data.siaexp),
           data.dbsCertificateNumber || null, data.employeeNumber || null, data.placeOfBirth || data.place_of_birth || null, supplierId, extId]
        );
        result.created++;
        return { userId: existing.userId, empId: empResult.rows[0]?.id || null };
      }
    }

    const crypto = await import("crypto");
    const userId = crypto.randomUUID();
    const emailToUse = email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}.${extId}.${Date.now().toString(36)}@needs-onboarding.local`;
    const username = email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}.${extId}.${Date.now().toString(36)}`;

    await pool.query(
      `INSERT INTO users (id, tenant_id, username, email, password, first_name, last_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, 'NEEDS_ONBOARDING', $5, $6, $7, 'employee', false)`,
      [userId, tenantId, username, emailToUse, firstName, lastName, data.phone || data.telephone || null]
    );

    const empResult = await pool.query(
      `INSERT INTO employees (user_id, tenant_id, date_of_birth, national_insurance, address_line_1, address_line_2, city, county, postcode, gender, nationality, job_title, sia_license_number, sia_expiry_date, dbs_certificate_number, employee_number, place_of_birth, supplier_id, external_id, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW()) RETURNING id`,
      [userId, tenantId, sanitizeDate(data.dateOfBirth || data.dob), data.nationalInsurance || data.ni_number || null,
       data.addressLine1 || data.add1 || null, data.addressLine2 || data.add2 || null,
       data.city || null, data.county || null, data.postcode || null,
       data.gender || null, data.nationality || null,
       data.jobTitle || null, data.siaLicenseNumber || data.sia || null, sanitizeDate(data.siaExpiryDate || data.siaexp),
       data.dbsCertificateNumber || null, data.employeeNumber || null, data.placeOfBirth || data.place_of_birth || null, supplierId, extId]
    );

    result.created++;
    return { userId, empId: empResult.rows[0]?.id || null };
  } catch (err: any) {
    if (err.code === "23505") {
      const retryResult = await findEmployeeByExtIdOrName(tenantId, extId, firstName, lastName, email || undefined);
      if (retryResult.userId || retryResult.empId) {
        result.skipped++;
        return retryResult;
      }
      try {
        const placeholderCrypto = await import("crypto");
        const placeholderUserId = placeholderCrypto.randomUUID();
        const placeholderEmail = `sync-${extId}-${tenantId}@placeholder.local`;
        const placeholderUsername = `sync_${extId}_${tenantId}_${Date.now()}`;
        await pool.query(
          `INSERT INTO users (id, tenant_id, username, email, password, first_name, last_name, phone, role, is_active)
           VALUES ($1, $2, $3, $4, 'NEEDS_ONBOARDING', $5, $6, $7, 'employee', false)`,
          [placeholderUserId, tenantId, placeholderUsername, placeholderEmail, firstName, lastName, data.phone || null]
        );
        const empResult2 = await pool.query(
          `INSERT INTO employees (user_id, tenant_id, external_id, last_synced_at, supplier_id)
           VALUES ($1, $2, $3, NOW(), $4) RETURNING id`,
          [placeholderUserId, tenantId, extId, supplierId]
        );
        result.created++;
        return { userId: placeholderUserId, empId: empResult2.rows[0]?.id || null };
      } catch {
        result.skipped++;
        return { userId: null, empId: null };
      }
    }
    result.failed++;
    result.errors.push(`Employee ${data.firstName || data.fullName || ""} ${data.lastName || ""} (${extId}): ${err.message}`);
    return { userId: null, empId: null };
  }
}

export async function checkShiftDuplicate(
  tenantId: number,
  extId: string,
  employeeId: string | number | null,
  siteId: number | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null,
  dryRun: boolean = false
): Promise<{ isDuplicate: boolean; existingId?: number }> {
  const byExt = await pool.query(
    `SELECT id FROM shifts WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExt.rows.length > 0) {
    if (!dryRun) {
      await pool.query(`UPDATE shifts SET last_synced_at = NOW() WHERE id = $1`, [byExt.rows[0].id]);
    }
    return { isDuplicate: true, existingId: byExt.rows[0].id };
  }

  if (employeeId && siteId && date && startTime && endTime) {
    const startNorm = startTime.substring(0, 5);
    const endNorm = endTime.substring(0, 5);
    const compositeCheck = await pool.query(
      `SELECT id FROM shifts WHERE tenant_id = $1
       AND employee_id = $2 AND site_id = $3 AND date::text = $4
       AND (CASE WHEN start_time LIKE '____-__-__ %' THEN SUBSTRING(start_time FROM 12 FOR 5) ELSE LEFT(start_time::text, 5) END) = $5
       AND (CASE WHEN end_time LIKE '____-__-__ %' THEN SUBSTRING(end_time FROM 12 FOR 5) ELSE LEFT(end_time::text, 5) END) = $6 LIMIT 1`,
      [tenantId, employeeId, siteId, date, startNorm, endNorm]
    );
    if (compositeCheck.rows.length > 0) {
      if (!dryRun) {
        await pool.query(
          `UPDATE shifts SET external_id = COALESCE(external_id, $1), last_synced_at = NOW() WHERE id = $2`,
          [extId, compositeCheck.rows[0].id]
        );
      }
      return { isDuplicate: true, existingId: compositeCheck.rows[0].id };
    }
  }

  return { isDuplicate: false };
}

export const DEPENDENCY_ORDER = ["clients", "sites", "suppliers", "employees", "shifts"] as const;
export type SyncEntityType = typeof DEPENDENCY_ORDER[number];

export async function syncEmployeeBankDetails(
  employeeId: number,
  bankData: { bankname?: string; acctitle?: string; sortcode?: string; account?: string }
): Promise<boolean> {
  if (!bankData.bankname && !bankData.sortcode && !bankData.account && !bankData.acctitle) return false;

  const existing = await pool.query(
    `SELECT id FROM bank_details WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  if (existing.rows.length > 0) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (bankData.bankname) { sets.push(`bank_name = $${idx}`); vals.push(bankData.bankname); idx++; }
    if (bankData.acctitle) { sets.push(`account_name = $${idx}`); vals.push(bankData.acctitle); idx++; }
    if (bankData.sortcode) { sets.push(`sort_code = $${idx}`); vals.push(bankData.sortcode); idx++; }
    if (bankData.account) { sets.push(`account_number = $${idx}`); vals.push(bankData.account); idx++; }
    sets.push("updated_at = NOW()");
    vals.push(employeeId);
    await pool.query(
      `UPDATE bank_details SET ${sets.join(", ")} WHERE employee_id = $${idx}`,
      vals
    );
    return true;
  }

  await pool.query(
    `INSERT INTO bank_details (employee_id, account_name, bank_name, sort_code, account_number)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      employeeId,
      bankData.acctitle || "Unknown",
      bankData.bankname || "Unknown",
      bankData.sortcode || "",
      bankData.account || "",
    ]
  );
  return true;
}

export async function syncEmployeeDocuments(
  employeeId: number,
  tenantId: number,
  documents: Array<{ type: string; path: string; status?: number; created?: string; uploadedDate?: string }>
): Promise<number> {
  let synced = 0;
  for (const doc of documents) {
    if (!doc.path || !doc.type) continue;

    const fileUrl = doc.path.startsWith("http") ? doc.path : `https://gfmtrack.co.uk/${doc.path}`;

    const existing = await pool.query(
      `SELECT id FROM documents WHERE employee_id = $1 AND tenant_id = $2 AND file_url = $3 LIMIT 1`,
      [employeeId, tenantId, fileUrl]
    );

    if (existing.rows.length > 0) {
      if (doc.uploadedDate) {
        await pool.query(
          `UPDATE documents SET external_uploaded_at = $1 WHERE id = $2`,
          [new Date(doc.uploadedDate), existing.rows[0].id]
        );
      }
      continue;
    }

    const fileName = fileUrl.split("/").pop() || doc.type;
    const extUploadedAt = doc.uploadedDate ? new Date(doc.uploadedDate) : null;

    await pool.query(
      `INSERT INTO documents (employee_id, tenant_id, document_type, file_name, file_url, is_verified, external_uploaded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        employeeId,
        tenantId,
        doc.type,
        fileName,
        fileUrl,
        doc.status === 1,
        extUploadedAt,
        doc.created ? new Date(doc.created) : new Date(),
      ]
    );
    synced++;
  }
  return synced;
}

export async function syncEmploymentHistory(
  employeeId: number,
  history: Array<{
    company?: string; jobTitle?: string; empFrom?: string; empTo?: string;
    currentlyWork?: string; jobDescription?: string; reason?: string;
    refName?: string; phone?: string; email?: string;
    verify?: string; submittedDate?: string; address?: string; postcode?: string;
  }>
): Promise<number> {
  let synced = 0;
  for (const h of history) {
    if (!h.company) continue;

    const existing = await pool.query(
      `SELECT id FROM employment_history WHERE employee_id = $1 AND employer_name = $2 AND date_from = $3 LIMIT 1`,
      [employeeId, h.company, sanitizeDate(h.empFrom)]
    );

    if (existing.rows.length > 0) {
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      if (h.jobTitle) { sets.push(`job_title = $${idx}`); vals.push(h.jobTitle); idx++; }
      if (sanitizeDate(h.empTo)) { sets.push(`date_to = $${idx}`); vals.push(sanitizeDate(h.empTo)); idx++; }
      if (h.reason) { sets.push(`reason_for_leaving = $${idx}`); vals.push(h.reason); idx++; }
      if (h.jobDescription) { sets.push(`duties = $${idx}`); vals.push(h.jobDescription); idx++; }
      if (h.verify) { sets.push(`verification_status = $${idx}`); vals.push(h.verify); idx++; }
      if (h.submittedDate) { sets.push(`submitted_date = $${idx}`); vals.push(h.submittedDate); idx++; }
      if (h.address) { sets.push(`referee_address = $${idx}`); vals.push(h.address); idx++; }
      if (h.postcode) { sets.push(`referee_postcode = $${idx}`); vals.push(h.postcode); idx++; }
      sets.push(`is_current = $${idx}`); vals.push(h.currentlyWork === "yes"); idx++;
      if (sets.length > 0) {
        vals.push(existing.rows[0].id);
        await pool.query(`UPDATE employment_history SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
      }
    } else {
      await pool.query(
        `INSERT INTO employment_history (employee_id, employer_name, job_title, date_from, date_to, is_current, reason_for_leaving, duties, verification_status, submitted_date, referee_address, referee_postcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          employeeId,
          h.company,
          h.jobTitle || "Unknown",
          sanitizeDate(h.empFrom),
          sanitizeDate(h.empTo),
          h.currentlyWork === "yes",
          h.reason || null,
          h.jobDescription || null,
          h.verify || null,
          sanitizeDate(h.submittedDate),
          h.address || null,
          h.postcode || null,
        ]
      );
      synced++;
    }

    if (h.refName) {
      const refExists = await pool.query(
        `SELECT id FROM "references" WHERE employee_id = $1 AND company = $2 LIMIT 1`,
        [employeeId, h.company]
      );
      if (refExists.rows.length === 0) {
        await pool.query(
          `INSERT INTO "references" (employee_id, referee_name, referee_email, referee_phone, company, job_title, status, verification_status)
           VALUES ($1, $2, $3, $4, $5, $6, 'not_started', $7)`,
          [employeeId, h.refName, h.email || null, h.phone || null, h.company, h.jobTitle || null, h.verify || null]
        );
      } else {
        const refSets: string[] = [];
        const refVals: any[] = [];
        let rIdx = 1;
        if (h.refName) { refSets.push(`referee_name = $${rIdx}`); refVals.push(h.refName); rIdx++; }
        if (h.email) { refSets.push(`referee_email = $${rIdx}`); refVals.push(h.email); rIdx++; }
        if (h.phone) { refSets.push(`referee_phone = $${rIdx}`); refVals.push(h.phone); rIdx++; }
        if (h.verify) { refSets.push(`verification_status = $${rIdx}`); refVals.push(h.verify); rIdx++; }
        if (refSets.length > 0) {
          refVals.push(refExists.rows[0].id);
          await pool.query(`UPDATE "references" SET ${refSets.join(", ")} WHERE id = $${rIdx}`, refVals);
        }
      }
    }
  }
  return synced;
}

export async function syncPassportData(
  employeeId: number,
  tenantId: number,
  passportData: {
    passport?: { docNo?: string; countryIssue?: string; dateOfIssue?: string; dateOfExpiry?: string };
    visa?: { type?: string; issueDate?: string; expiryDate?: string; needed?: string; dateOfEntry?: string };
    shareCode?: { code?: string; expiryDate?: string };
    brp?: { number?: string; expiryDate?: string; needed?: string };
  }
): Promise<number> {
  const immigrationData: Record<string, any> = { tenantId };

  if (passportData.passport) {
    const p = passportData.passport;
    if (p.docNo) immigrationData.passportDocNo = p.docNo;
    if (p.countryIssue) immigrationData.passportCountry = p.countryIssue;
    if (sanitizeDate(p.dateOfIssue)) immigrationData.passportIssueDate = sanitizeDate(p.dateOfIssue);
    if (sanitizeDate(p.dateOfExpiry)) immigrationData.passportExpiryDate = sanitizeDate(p.dateOfExpiry);
  }

  if (passportData.visa) {
    const v = passportData.visa;
    immigrationData.visaNeeded = v.needed === "yes";
    if (v.type) immigrationData.visaType = v.type;
    if (sanitizeDate(v.issueDate)) immigrationData.visaIssueDate = sanitizeDate(v.issueDate);
    if (sanitizeDate(v.expiryDate)) immigrationData.visaExpiryDate = sanitizeDate(v.expiryDate);
    if (sanitizeDate(v.dateOfEntry)) immigrationData.visaDateOfEntry = sanitizeDate(v.dateOfEntry);
  }

  if (passportData.shareCode) {
    if (passportData.shareCode.code) immigrationData.shareCode = passportData.shareCode.code;
    if (sanitizeDate(passportData.shareCode.expiryDate)) immigrationData.shareCodeExpiry = sanitizeDate(passportData.shareCode.expiryDate);
  }

  if (passportData.brp) {
    immigrationData.brpNeeded = passportData.brp.needed === "yes";
    if (passportData.brp.number) immigrationData.brpNumber = passportData.brp.number;
    if (sanitizeDate(passportData.brp.expiryDate)) immigrationData.brpExpiry = sanitizeDate(passportData.brp.expiryDate);
  }

  const hasData = Object.keys(immigrationData).length > 1;
  if (!hasData) return 0;

  const existing = await pool.query(
    `SELECT id FROM employee_immigration WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  if (existing.rows.length > 0) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      passportDocNo: "passport_doc_no", passportCountry: "passport_country",
      passportIssueDate: "passport_issue_date", passportExpiryDate: "passport_expiry_date",
      visaNeeded: "visa_needed", visaType: "visa_type",
      visaIssueDate: "visa_issue_date", visaExpiryDate: "visa_expiry_date",
      visaDateOfEntry: "visa_date_of_entry",
      shareCode: "share_code", shareCodeExpiry: "share_code_expiry",
      brpNeeded: "brp_needed", brpNumber: "brp_number", brpExpiry: "brp_expiry",
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (immigrationData[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        vals.push(immigrationData[key]);
        idx++;
      }
    }
    sets.push("updated_at = NOW()");
    if (sets.length > 1) {
      vals.push(employeeId);
      await pool.query(
        `UPDATE employee_immigration SET ${sets.join(", ")} WHERE employee_id = $${idx}`,
        vals
      );
    }
    return 1;
  }

  const cols = ["employee_id", "tenant_id"];
  const placeholders = ["$1", "$2"];
  const insertVals: any[] = [employeeId, tenantId];
  let pIdx = 3;
  const colMap: Record<string, string> = {
    passportDocNo: "passport_doc_no", passportCountry: "passport_country",
    passportIssueDate: "passport_issue_date", passportExpiryDate: "passport_expiry_date",
    visaNeeded: "visa_needed", visaType: "visa_type",
    visaIssueDate: "visa_issue_date", visaExpiryDate: "visa_expiry_date",
    visaDateOfEntry: "visa_date_of_entry",
    shareCode: "share_code", shareCodeExpiry: "share_code_expiry",
    brpNeeded: "brp_needed", brpNumber: "brp_number", brpExpiry: "brp_expiry",
  };
  for (const [key, col] of Object.entries(colMap)) {
    if (immigrationData[key] !== undefined) {
      cols.push(col);
      placeholders.push(`$${pIdx}`);
      insertVals.push(immigrationData[key]);
      pIdx++;
    }
  }

  await pool.query(
    `INSERT INTO employee_immigration (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
    insertVals
  );
  return 1;
}
