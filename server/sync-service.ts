import { pool } from "./db";
import { storage } from "./storage";
import type { SyncConfiguration, SyncLog } from "@shared/schema";
import { findFuzzySiteMatches, normalizeSiteName } from "./dedup-utils";
import {
  EntitySyncResult, EntityBreakdown, newEntitySyncResult, mergeResults,
  upsertClient, upsertSupplier, upsertSite, upsertEmployee,
  checkShiftDuplicate, DEPENDENCY_ORDER, buildFillBlanksUpdate,
  findByExternalId, findEmployeeByExtIdOrName, findSiteByExtIdOrFuzzy,
  findClientByNameOrExtId, findSupplierByNameOrExtId,
  syncEmployeeBankDetails, syncEmployeeDocuments, syncEmploymentHistory, syncPassportData,
  sanitizeDate,
} from "./sync-utils";

interface ExternalPaginatedResponse {
  data: any[];
  pagination: {
    page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
  };
}

function isPhpApi(config: { connectionType?: string; apiBaseUrl: string }): boolean {
  if (config.connectionType) return config.connectionType === "php";
  return config.apiBaseUrl.includes(".php");
}

function isRestPhpApi(config: { connectionType?: string }): boolean {
  return config.connectionType === "rest_php";
}

function isPhpEmployeesApi(config: { connectionType?: string }): boolean {
  return config.connectionType === "php_employees";
}

function needsDateRange(config: { connectionType?: string; apiBaseUrl: string }): boolean {
  return isPhpApi(config) || isRestPhpApi(config);
}

function stripEntityPrefix(id: string): string {
  return String(id).replace(/^(SUP|CLT|SITE|EMP|SHIFT)-/i, "");
}

const VALID_SHIFT_STATUSES = new Set([
  "scheduled", "in_progress", "completed", "cancelled", "no_show",
  "booked_on", "booked_off", "verified", "missed"
]);

function mapShiftStatus(status: string | null | undefined): string {
  if (!status) return "scheduled";
  const normalized = status.toLowerCase().trim();
  if (VALID_SHIFT_STATUSES.has(normalized)) return normalized;
  if (normalized === "pending" || normalized === "confirmed" || normalized === "assigned") return "scheduled";
  if (normalized === "in-progress" || normalized === "active" || normalized === "ongoing") return "in_progress";
  if (normalized === "done" || normalized === "finished") return "completed";
  if (normalized === "canceled") return "cancelled";
  return "scheduled";
}

async function fetchFromRestPhpApi(
  url: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  supplierId?: string
): Promise<any[]> {
  const allData: any[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const params = new URLSearchParams({
      api_key: apiKey,
      date_from: dateFrom,
      date_to: dateTo,
      page: String(page),
      per_page: String(perPage),
    });
    if (supplierId) params.set("supplier_id", supplierId);

    const fullUrl = `${url.replace(/\/$/, "")}?${params.toString()}`;
    const response = await fetch(fullUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`);
    }

    const body: ExternalPaginatedResponse = await response.json();
    allData.push(...(body.data || []));

    if (page >= (body.pagination?.total_pages || 1)) break;
    page++;
  }

  return allData;
}

function extractEntitiesFromRestPhpShifts(shifts: any[]): {
  suppliers: Map<string, string>;
  clients: Map<string, string>;
  sites: Map<string, { name: string; clientExtId: string }>;
  employees: Map<string, { name: string; email: string; supplierExtId: string }>;
} {
  const suppliers = new Map<string, string>();
  const clients = new Map<string, string>();
  const sites = new Map<string, { name: string; clientExtId: string }>();
  const employees = new Map<string, { name: string; email: string; supplierExtId: string }>();

  for (const s of shifts) {
    if (s.supplierId) suppliers.set(stripEntityPrefix(s.supplierId), s.supplierName || stripEntityPrefix(s.supplierId));
    if (s.clientId) clients.set(stripEntityPrefix(s.clientId), s.clientName || stripEntityPrefix(s.clientId));
    if (s.siteId) sites.set(stripEntityPrefix(s.siteId), { name: s.siteName || stripEntityPrefix(s.siteId), clientExtId: stripEntityPrefix(s.clientId || "") });
    if (s.employeeId) {
      const empExtId = stripEntityPrefix(s.employeeId);
      const existing = employees.get(empExtId);
      const email = (s.employeeEmail || "").trim();
      if (!existing || (!existing.email && email)) {
        employees.set(empExtId, { name: s.employeeName || empExtId, email, supplierExtId: stripEntityPrefix(s.supplierId || "") });
      }
    }
  }

  return { suppliers, clients, sites, employees };
}

async function syncRestPhpShifts(
  tenantId: number,
  shifts: any[],
  supplierMap: Map<string, number>,
  clientMap: Map<string, number>,
  siteMap: Map<string, number>,
  employeeMap: Map<string, number>
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of shifts) {
    try {
      const extId = stripEntityPrefix(item.id);
      const existingResult = await pool.query(
        `SELECT id FROM shifts WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );
      if (existingResult.rows.length > 0) {
        await pool.query(`UPDATE shifts SET last_synced_at = NOW() WHERE id = $1`, [existingResult.rows[0].id]);
        result.skipped++;
        continue;
      }

      const employeeId = item.employeeId ? (employeeMap.get(stripEntityPrefix(item.employeeId)) || null) : null;
      const siteId = item.siteId ? (siteMap.get(stripEntityPrefix(item.siteId)) || null) : null;
      const supplierId = item.supplierId ? (supplierMap.get(stripEntityPrefix(item.supplierId)) || null) : null;

      if (employeeId && siteId && item.date && item.startTime && item.endTime) {
        const startNorm = (item.startTime || "").substring(0, 5);
        const endNorm = (item.endTime || "").substring(0, 5);
        const compositeKey = `${employeeId}|${siteId}|${item.date}|${startNorm}|${endNorm}`;
        const compositeCheck = await pool.query(
          `SELECT id FROM shifts WHERE tenant_id = $1 AND (employee_id::text || '|' || site_id::text || '|' || date::text || '|' ||
           CASE WHEN start_time LIKE '____-__-__ %' THEN SUBSTRING(start_time FROM 12 FOR 5) ELSE LEFT(start_time::text, 5) END || '|' ||
           CASE WHEN end_time LIKE '____-__-__ %' THEN SUBSTRING(end_time FROM 12 FOR 5) ELSE LEFT(end_time::text, 5) END) = $2 LIMIT 1`,
          [tenantId, compositeKey]
        );
        if (compositeCheck.rows.length > 0) {
          await pool.query(
            `UPDATE shifts SET external_id = COALESCE(external_id, $1), last_synced_at = NOW() WHERE id = $2`,
            [extId, compositeCheck.rows[0].id]
          );
          result.skipped++;
          continue;
        }
      }

      const title = `${item.siteName || item.siteId || "Shift"} - ${item.date}`;

      await pool.query(
        `INSERT INTO shifts (tenant_id, employee_id, site_id, supplier_id, title, date, start_time, end_time, status, notes, external_id, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          tenantId, employeeId, siteId, supplierId,
          title,
          item.date,
          item.startTime || "00:00",
          item.endTime || "00:00",
          mapShiftStatus(item.status),
          item.notes || null, extId,
        ]
      );
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Shift ${item.id}: ${err.message}`);
    }
  }
  return result;
}

async function fetchFromPhpApi(
  url: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  supplierId?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    shift_from: dateFrom,
    shift_to: dateTo,
  });
  if (supplierId) params.set("contractor_id", supplierId);

  const fullUrl = `${url.replace(/\/$/, "")}?${params.toString()}`;
  const response = await fetch(fullUrl, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  if (!body.success) {
    throw new Error(body.error || "API returned unsuccessful response");
  }

  return body.data || [];
}

function extractEntitiesFromPhpShifts(shifts: any[]): {
  suppliers: Map<string, string>;
  clients: Map<string, string>;
  sites: Map<string, { name: string; clientExtId: string }>;
  employees: Map<string, { name: string; supplierExtId: string }>;
} {
  const suppliers = new Map<string, string>();
  const clients = new Map<string, string>();
  const sites = new Map<string, { name: string; clientExtId: string }>();
  const employees = new Map<string, { name: string; supplierExtId: string }>();

  for (const s of shifts) {
    if (s.SupplierID && s.Supplier) suppliers.set(String(s.SupplierID), s.Supplier);
    if (s.ClientID && s.Client) clients.set(String(s.ClientID), s.Client);
    if (s.LocationID && s.location) sites.set(String(s.LocationID), { name: s.location, clientExtId: String(s.ClientID || "") });
    if (s.officer_id && s.officer_name) employees.set(String(s.officer_id), { name: s.officer_name, supplierExtId: String(s.SupplierID || "") });
  }

  return { suppliers, clients, sites, employees };
}

async function ensureSupplierFromPhp(tenantId: number, extId: string, name: string): Promise<number | null> {
  const existing = await pool.query(
    `SELECT id FROM suppliers WHERE tenant_id = $1 AND (
      external_id = $2
      OR LOWER(company_name) = LOWER($3)
      OR (LENGTH(company_name) >= 5 AND LOWER(REPLACE($3, '&', 'and')) LIKE LOWER(REPLACE(company_name, '&', 'and')) || '%')
      OR (LENGTH($3) >= 5 AND LOWER(REPLACE(company_name, '&', 'and')) LIKE LOWER(REPLACE($3, '&', 'and')) || '%')
    ) LIMIT 1`,
    [tenantId, extId, name]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE suppliers SET external_id = COALESCE(external_id, $1) WHERE id = $2`,
      [extId, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO suppliers (tenant_id, company_name, contact_name, email, supplier_type, status, external_id)
     VALUES ($1, $2, 'Imported Contact', $3, 'labour', 'active', $4) RETURNING id`,
    [tenantId, name, `imported-${extId}@needs-update.local`, extId]
  );
  return result.rows[0]?.id || null;
}

async function ensureClientFromPhp(tenantId: number, extId: string, name: string): Promise<number | null> {
  const byExtId = await pool.query(
    `SELECT id FROM clients WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExtId.rows.length > 0) {
    return byExtId.rows[0].id;
  }

  const normalizedIncoming = normalizeSiteName(name);
  const allClients = await pool.query(`SELECT id, company_name, external_id FROM clients WHERE tenant_id = $1`, [tenantId]);
  const matched = allClients.rows.find((c: any) => {
    const norm = normalizeSiteName(c.company_name);
    return norm === normalizedIncoming ||
      c.company_name.toLowerCase().trim() === name.toLowerCase().trim() ||
      (norm.length >= 5 && (norm.startsWith(normalizedIncoming) || normalizedIncoming.startsWith(norm)));
  });

  if (matched) {
    await pool.query(
      `UPDATE clients SET external_id = COALESCE(external_id, $1) WHERE id = $2`,
      [extId, matched.id]
    );
    return matched.id;
  }

  const result = await pool.query(
    `INSERT INTO clients (tenant_id, company_name, external_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, name, extId]
  );
  return result.rows[0]?.id || null;
}

async function ensureSiteFromPhp(
  tenantId: number,
  extId: string,
  name: string,
  clientId: number | null,
  siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>
): Promise<number | null> {
  const byExtId = await pool.query(
    `SELECT id FROM sites WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (byExtId.rows.length > 0) {
    await pool.query(
      `UPDATE sites SET client_id = COALESCE(client_id, $1) WHERE id = $2`,
      [clientId, byExtId.rows[0].id]
    );
    return byExtId.rows[0].id;
  }

  const decision = siteDecisions?.[name] || siteDecisions?.[name.toLowerCase()];
  if (decision?.action === "use_existing" && decision.siteId) {
    await pool.query(
      `UPDATE sites SET external_id = COALESCE(external_id, $1), client_id = COALESCE(client_id, $2) WHERE id = $3`,
      [extId, clientId, decision.siteId]
    );
    return decision.siteId;
  }
  if (decision?.action === "create_new") {
    const result = await pool.query(
      `INSERT INTO sites (tenant_id, name, address, client_id, is_active, external_id)
       VALUES ($1, $2, $2, $3, true, $4) RETURNING id`,
      [tenantId, name, clientId, extId]
    );
    return result.rows[0]?.id || null;
  }

  const allSites = await pool.query(
    `SELECT id, name, postcode FROM sites WHERE tenant_id = $1`,
    [tenantId]
  );
  const fuzzyMatches = findFuzzySiteMatches(name, allSites.rows);
  if (fuzzyMatches.length > 0) {
    const matchedId = fuzzyMatches[0].siteId;
    await pool.query(
      `UPDATE sites SET external_id = COALESCE(external_id, $1), client_id = COALESCE(client_id, $2) WHERE id = $3`,
      [extId, clientId, matchedId]
    );
    return matchedId;
  }

  const result = await pool.query(
    `INSERT INTO sites (tenant_id, name, address, client_id, is_active, external_id)
     VALUES ($1, $2, $2, $3, true, $4) RETURNING id`,
    [tenantId, name, clientId, extId]
  );
  return result.rows[0]?.id || null;
}

async function ensureEmployeeFromPhp(tenantId: number, extId: string, fullName: string, supplierId: number | null): Promise<number | null> {
  const existing = await pool.query(
    `SELECT id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
    [tenantId, extId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "Unknown";

  const existingByName = await pool.query(
    `SELECT e.id AS emp_id FROM users u JOIN employees e ON e.user_id = u.id
     WHERE u.tenant_id = $1 AND LOWER(u.first_name) = LOWER($2) AND LOWER(u.last_name) = LOWER($3) LIMIT 1`,
    [tenantId, firstName, lastName]
  );
  if (existingByName.rows.length > 0) {
    const empId = existingByName.rows[0].emp_id;
    await pool.query(
      `UPDATE employees SET external_id = COALESCE(external_id, $1), supplier_id = COALESCE(supplier_id, $2) WHERE id = $3`,
      [extId, supplierId, empId]
    );
    return empId;
  }

  const { v4: uuidv4 } = await import("uuid");
  const userId = uuidv4();
  const suffix = `${extId}.${Date.now().toString(36)}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}.${suffix}@needs-onboarding.local`;
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}.${suffix}`;

  try {
    await pool.query(
      `INSERT INTO users (id, username, email, password, first_name, last_name, role, tenant_id)
       VALUES ($1, $2, $3, 'NEEDS_ONBOARDING', $4, $5, 'employee', $6)`,
      [userId, username, email, firstName, lastName, tenantId]
    );
  } catch (err: any) {
    if (err.code === "23505") {
      return null;
    }
    throw err;
  }

  const empResult = await pool.query(
    `INSERT INTO employees (user_id, tenant_id, supplier_id, external_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, tenantId, supplierId, extId]
  );

  return empResult.rows[0]?.id || null;
}

async function syncPhpShifts(
  tenantId: number,
  shifts: any[],
  supplierMap: Map<string, number>,
  clientMap: Map<string, number>,
  siteMap: Map<string, number>,
  employeeMap: Map<string, number>
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of shifts) {
    try {
      const extId = String(item.shift_id);
      const existingResult = await pool.query(
        `SELECT id FROM shifts WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );
      if (existingResult.rows.length > 0) {
        await pool.query(`UPDATE shifts SET last_synced_at = NOW() WHERE id = $1`, [existingResult.rows[0].id]);
        result.skipped++;
        continue;
      }

      const employeeId = employeeMap.get(String(item.officer_id)) || null;
      const siteId = siteMap.get(String(item.LocationID)) || null;
      const supplierId = supplierMap.get(String(item.SupplierID)) || null;

      if (employeeId && siteId && item.shift_date && item.time_start && item.time_finish) {
        const startNorm = (item.time_start || "").substring(0, 5);
        const endNorm = (item.time_finish || "").substring(0, 5);
        const compositeKey = `${employeeId}|${siteId}|${item.shift_date}|${startNorm}|${endNorm}`;
        const compositeCheck = await pool.query(
          `SELECT id FROM shifts WHERE tenant_id = $1 AND (employee_id::text || '|' || site_id::text || '|' || date::text || '|' ||
           CASE WHEN start_time LIKE '____-__-__ %' THEN SUBSTRING(start_time FROM 12 FOR 5) ELSE LEFT(start_time::text, 5) END || '|' ||
           CASE WHEN end_time LIKE '____-__-__ %' THEN SUBSTRING(end_time FROM 12 FOR 5) ELSE LEFT(end_time::text, 5) END) = $2 LIMIT 1`,
          [tenantId, compositeKey]
        );
        if (compositeCheck.rows.length > 0) {
          await pool.query(
            `UPDATE shifts SET external_id = COALESCE(external_id, $1), last_synced_at = NOW() WHERE id = $2`,
            [extId, compositeCheck.rows[0].id]
          );
          result.skipped++;
          continue;
        }
      }

      const title = `${item.location || "Shift"} - ${item.shift_date}`;

      await pool.query(
        `INSERT INTO shifts (tenant_id, employee_id, site_id, supplier_id, title, date, start_time, end_time, status, external_id, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, NOW())`,
        [
          tenantId, employeeId, siteId, supplierId,
          title,
          item.shift_date,
          item.time_start || "00:00",
          item.time_finish || "00:00",
          extId,
        ]
      );
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Shift ${item.shift_id}: ${err.message}`);
    }
  }
  return result;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

async function fetchPaginated(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  modifiedSince?: Date | null,
  extraParams?: Record<string, string>
): Promise<any[]> {
  const allData: any[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (modifiedSince) {
      params.set("modified_since", modifiedSince.toISOString());
    }
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        params.set(k, v);
      }
    }

    const url = `${baseUrl.replace(/\/$/, "")}${endpoint}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`);
    }

    const body: ExternalPaginatedResponse = await response.json();
    allData.push(...(body.data || []));

    if (page >= (body.pagination?.total_pages || 1)) break;
    page++;
  }

  return allData;
}

async function syncClients(tenantId: number, data: any[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of data) {
    try {
      const extId = String(item.id);
      const byExtId = await pool.query(
        `SELECT id FROM clients WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );
      let existingResult = byExtId;
      if (byExtId.rows.length === 0 && item.companyName) {
        const normalizedIncoming = normalizeSiteName(item.companyName);
        const allClients = await pool.query(`SELECT id, company_name FROM clients WHERE tenant_id = $1`, [tenantId]);
        const matched = allClients.rows.find((c: any) => {
          const norm = normalizeSiteName(c.company_name);
          return norm === normalizedIncoming ||
            c.company_name.toLowerCase().trim() === item.companyName.toLowerCase().trim() ||
            (norm.length >= 5 && (norm.startsWith(normalizedIncoming) || normalizedIncoming.startsWith(norm)));
        });
        if (matched) existingResult = await pool.query(`SELECT id FROM clients WHERE id = $1`, [matched.id]);
      }

      if (existingResult.rows.length > 0) {
        const clientId = existingResult.rows[0].id;
        const updates: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

        const fieldMap: Record<string, string> = {
          contactName: "contact_name",
          contactEmail: "contact_email",
          contactPhone: "contact_phone",
          address: "address",
          postcode: "postcode",
          companyRegNumber: "company_reg_number",
          contractRef: "contract_ref",
        };

        for (const [extField, dbField] of Object.entries(fieldMap)) {
          if (item[extField]) {
            updates.push(`${dbField} = COALESCE(${dbField}, $${paramIdx})`);
            values.push(item[extField]);
            paramIdx++;
          }
        }

        if (item.id) {
          updates.push(`external_id = $${paramIdx}`);
          values.push(extId);
          paramIdx++;
        }

        updates.push(`last_synced_at = NOW()`);

        if (updates.length > 1) {
          values.push(clientId);
          await pool.query(
            `UPDATE clients SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
            values
          );
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await pool.query(
          `INSERT INTO clients (tenant_id, company_name, contact_name, contact_email, contact_phone, address, postcode, company_reg_number, contract_ref, external_id, last_synced_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            tenantId, item.companyName, item.contactName || null,
            item.contactEmail || null, item.contactPhone || null,
            item.address || null, item.postcode || null,
            item.companyRegNumber || null, item.contractRef || null, extId,
          ]
        );
        result.created++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Client ${item.companyName || item.id}: ${err.message}`);
    }
  }
  return result;
}

async function syncSuppliers(tenantId: number, data: any[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of data) {
    try {
      const extId = String(item.id);
      const existingResult = await pool.query(
        `SELECT id FROM suppliers WHERE tenant_id = $1 AND (
          external_id = $2
          OR LOWER(company_name) = LOWER($3)
          OR (LENGTH(company_name) >= 5 AND LOWER(REPLACE($3, '&', 'and')) LIKE LOWER(REPLACE(company_name, '&', 'and')) || '%')
          OR (LENGTH($3) >= 5 AND LOWER(REPLACE(company_name, '&', 'and')) LIKE LOWER(REPLACE($3, '&', 'and')) || '%')
        ) LIMIT 1`,
        [tenantId, extId, item.companyName || ""]
      );

      if (existingResult.rows.length > 0) {
        const supplierId = existingResult.rows[0].id;
        const updates: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

        const fieldMap: Record<string, string> = {
          contactName: "contact_name",
          email: "email",
          phone: "phone",
          vatNumber: "vat_number",
          companyRegNumber: "company_reg_number",
          address: "address",
          postcode: "postcode",
          bankName: "bank_name",
          accountName: "account_name",
          accountNumber: "account_number",
          sortCode: "sort_code",
        };

        for (const [extField, dbField] of Object.entries(fieldMap)) {
          const val = extField === "contactName"
            ? (item[extField] || item.contact_name || null)
            : item[extField];
          if (val) {
            updates.push(`${dbField} = COALESCE(${dbField}, $${paramIdx})`);
            values.push(val);
            paramIdx++;
          }
        }

        updates.push(`external_id = $${paramIdx}`);
        values.push(extId);
        paramIdx++;

        updates.push(`last_synced_at = NOW()`);

        values.push(supplierId);
        await pool.query(
          `UPDATE suppliers SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
          values
        );
        result.updated++;
      } else {
        await pool.query(
          `INSERT INTO suppliers (tenant_id, company_name, contact_name, email, phone, supplier_type, vat_number, company_reg_number, address, postcode, bank_name, account_name, account_number, sort_code, external_id, status, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', NOW())`,
          [
            tenantId, item.companyName, item.contactName || item.contact_name || null,
            item.email || 'unknown@needs-update.local', item.phone || null,
            item.supplierType || "labour",
            item.vatNumber || null, item.companyRegNumber || null,
            item.address || null, item.postcode || null,
            item.bankName || null, item.accountName || null,
            item.accountNumber || null, item.sortCode || null, extId,
          ]
        );
        result.created++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Supplier ${item.companyName || item.id}: ${err.message}`);
    }
  }
  return result;
}

async function syncSites(
  tenantId: number,
  data: any[],
  siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of data) {
    try {
      const extId = String(item.id);
      const byExtId = await pool.query(
        `SELECT id FROM sites WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );

      let clientId: number | null = null;
      if (item.clientId) {
        const clientResult = await pool.query(
          `SELECT id FROM clients WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, String(item.clientId)]
        );
        if (clientResult.rows.length > 0) clientId = clientResult.rows[0].id;
      }

      const decision = item.name ? (siteDecisions?.[item.name] || siteDecisions?.[item.name.toLowerCase()]) : undefined;

      let existingResult = byExtId;
      if (byExtId.rows.length === 0 && item.name) {
        if (decision?.action === "use_existing" && decision.siteId) {
          existingResult = await pool.query(`SELECT id FROM sites WHERE id = $1 LIMIT 1`, [decision.siteId]);
        } else if (decision?.action !== "create_new") {
          const allSites = await pool.query(`SELECT id, name, postcode FROM sites WHERE tenant_id = $1`, [tenantId]);
          const fuzzyMatches = findFuzzySiteMatches(item.name, allSites.rows);
          if (fuzzyMatches.length > 0) {
            existingResult = await pool.query(`SELECT id FROM sites WHERE id = $1 LIMIT 1`, [fuzzyMatches[0].siteId]);
          }
        }
      }

      if (existingResult.rows.length > 0) {
        const siteId = existingResult.rows[0].id;
        const updates: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

        const fieldMap: Record<string, string> = {
          address: "address",
          city: "city",
          postcode: "postcode",
          contractRef: "contract_ref",
        };

        for (const [extField, dbField] of Object.entries(fieldMap)) {
          if (item[extField]) {
            updates.push(`${dbField} = COALESCE(${dbField}, $${paramIdx})`);
            values.push(item[extField]);
            paramIdx++;
          }
        }

        if (item.latitude) {
          updates.push(`latitude = COALESCE(latitude, $${paramIdx})`);
          values.push(String(item.latitude));
          paramIdx++;
        }
        if (item.longitude) {
          updates.push(`longitude = COALESCE(longitude, $${paramIdx})`);
          values.push(String(item.longitude));
          paramIdx++;
        }
        if (clientId) {
          updates.push(`client_id = COALESCE(client_id, $${paramIdx})`);
          values.push(clientId);
          paramIdx++;
        }

        updates.push(`external_id = $${paramIdx}`);
        values.push(extId);
        paramIdx++;

        updates.push(`last_synced_at = NOW()`);

        values.push(siteId);
        await pool.query(
          `UPDATE sites SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
          values
        );
        result.updated++;
      } else {
        await pool.query(
          `INSERT INTO sites (tenant_id, name, address, city, postcode, latitude, longitude, client_id, contract_ref, external_id, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            tenantId, item.name, item.address || null,
            item.city || null, item.postcode || null,
            item.latitude ? String(item.latitude) : null,
            item.longitude ? String(item.longitude) : null,
            clientId, item.contractRef || null, extId,
          ]
        );
        result.created++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Site ${item.name || item.id}: ${err.message}`);
    }
  }
  return result;
}

async function syncEmployees(tenantId: number, data: any[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of data) {
    try {
      const extId = String(item.id);
      const email = (item.email || "").toLowerCase().trim();

      if (!email || !item.firstName || !item.lastName) {
        result.skipped++;
        continue;
      }

      const existingByExtId = await pool.query(
        `SELECT user_id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );

      let existingUser = existingByExtId.rows.length > 0
        ? await pool.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [existingByExtId.rows[0].user_id])
        : await pool.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
            [tenantId, email]
          );

      if (existingUser.rows.length === 0 && item.firstName && item.lastName) {
        existingUser = await pool.query(
          `SELECT u.id FROM users u JOIN employees e ON e.user_id = u.id WHERE u.tenant_id = $1 AND LOWER(u.first_name) = LOWER($2) AND LOWER(u.last_name) = LOWER($3) LIMIT 1`,
          [tenantId, item.firstName.trim(), item.lastName.trim()]
        );
      }

      let supplierId: number | null = null;
      if (item.supplierId) {
        const supplierResult = await pool.query(
          `SELECT id FROM suppliers WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, String(item.supplierId)]
        );
        if (supplierResult.rows.length > 0) supplierId = supplierResult.rows[0].id;
      }

      if (existingUser.rows.length > 0) {
        const userId = existingUser.rows[0].id;
        const userUpdates: string[] = [];
        const userValues: any[] = [];
        let paramIdx = 1;

        if (item.phone) {
          userUpdates.push(`phone = $${paramIdx}`);
          userValues.push(item.phone);
          paramIdx++;
        }

        if (userUpdates.length > 0) {
          userValues.push(userId);
          await pool.query(
            `UPDATE users SET ${userUpdates.join(", ")} WHERE id = $${paramIdx}`,
            userValues
          );
        }

        const empResult = await pool.query(
          `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
          [userId]
        );

        if (empResult.rows.length > 0) {
          const empId = empResult.rows[0].id;
          const empUpdates: string[] = [];
          const empValues: any[] = [];
          let eidx = 1;

          const empFieldMap: Record<string, string> = {
            dateOfBirth: "date_of_birth",
            nationalInsurance: "national_insurance",
            addressLine1: "address_line_1",
            city: "city",
            postcode: "postcode",
            jobTitle: "job_title",
            siaLicenseNumber: "sia_license_number",
            siaExpiryDate: "sia_expiry_date",
            dbsCertificateNumber: "dbs_certificate_number",
            employeeNumber: "employee_number",
          };

          for (const [extField, dbField] of Object.entries(empFieldMap)) {
            if (item[extField]) {
              empUpdates.push(`${dbField} = COALESCE(${dbField}, $${eidx})`);
              empValues.push(item[extField]);
              eidx++;
            }
          }

          if (supplierId) {
            empUpdates.push(`supplier_id = COALESCE(supplier_id, $${eidx})`);
            empValues.push(supplierId);
            eidx++;
          }

          empUpdates.push(`external_id = $${eidx}`);
          empValues.push(extId);
          eidx++;

          empUpdates.push(`last_synced_at = NOW()`);

          empValues.push(empId);
          await pool.query(
            `UPDATE employees SET ${empUpdates.join(", ")} WHERE id = $${eidx}`,
            empValues
          );
        }

        result.updated++;
      } else {
        const userId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO users (id, tenant_id, username, email, password, first_name, last_name, phone, role, is_active)
           VALUES ($1, $2, $3, $4, 'NEEDS_ONBOARDING', $5, $6, $7, 'employee', false)`,
          [userId, tenantId, email, email, item.firstName, item.lastName, item.phone || null]
        );

        await pool.query(
          `INSERT INTO employees (user_id, tenant_id, date_of_birth, national_insurance, address_line_1, city, postcode, job_title, sia_license_number, sia_expiry_date, dbs_certificate_number, employee_number, supplier_id, external_id, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
          [
            userId, tenantId, item.dateOfBirth || null,
            item.nationalInsurance || null, item.addressLine1 || null,
            item.city || null, item.postcode || null,
            item.jobTitle || null, item.siaLicenseNumber || null,
            item.siaExpiryDate || null, item.dbsCertificateNumber || null,
            item.employeeNumber || null, supplierId, extId,
          ]
        );
        result.created++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Employee ${item.firstName} ${item.lastName} (${item.id}): ${err.message}`);
    }
  }
  return result;
}

async function syncShifts(tenantId: number, data: any[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of data) {
    try {
      const extId = String(item.id);

      const existingResult = await pool.query(
        `SELECT id FROM shifts WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, extId]
      );

      if (existingResult.rows.length > 0) {
        result.skipped++;
        continue;
      }

      let employeeId: string | null = null;
      let siteId: number | null = null;
      let supplierId: number | null = null;

      if (item.employeeId) {
        const empResult = await pool.query(
          `SELECT user_id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, String(item.employeeId)]
        );
        if (empResult.rows.length > 0) employeeId = empResult.rows[0].user_id;
      }

      if (item.siteId) {
        const siteResult = await pool.query(
          `SELECT id FROM sites WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, String(item.siteId)]
        );
        if (siteResult.rows.length > 0) siteId = siteResult.rows[0].id;
      }

      if (item.supplierId) {
        const supResult = await pool.query(
          `SELECT id FROM suppliers WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, String(item.supplierId)]
        );
        if (supResult.rows.length > 0) supplierId = supResult.rows[0].id;
      }

      if (employeeId && siteId && item.date && item.startTime && item.endTime) {
        const startNorm = (item.startTime || "").substring(0, 5);
        const endNorm = (item.endTime || "").substring(0, 5);
        const compositeKey = `${employeeId}|${siteId}|${item.date}|${startNorm}|${endNorm}`;
        const compositeCheck = await pool.query(
          `SELECT id FROM shifts WHERE tenant_id = $1 AND (employee_id::text || '|' || site_id::text || '|' || date::text || '|' ||
           CASE WHEN start_time LIKE '____-__-__ %' THEN SUBSTRING(start_time FROM 12 FOR 5) ELSE LEFT(start_time::text, 5) END || '|' ||
           CASE WHEN end_time LIKE '____-__-__ %' THEN SUBSTRING(end_time FROM 12 FOR 5) ELSE LEFT(end_time::text, 5) END) = $2 LIMIT 1`,
          [tenantId, compositeKey]
        );
        if (compositeCheck.rows.length > 0) {
          await pool.query(
            `UPDATE shifts SET external_id = COALESCE(external_id, $1) WHERE id = $2`,
            [extId, compositeCheck.rows[0].id]
          );
          result.skipped++;
          continue;
        }
      }

      await pool.query(
        `INSERT INTO shifts (tenant_id, employee_id, site_id, supplier_id, title, date, start_time, end_time, status, notes, external_id, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          tenantId, employeeId, siteId, supplierId,
          `Shift ${extId}`,
          item.date, item.startTime, item.endTime,
          mapShiftStatus(item.status),
          item.notes || null, extId,
        ]
      );
      result.created++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Shift ${item.id}: ${err.message}`);
    }
  }
  return result;
}

async function enrichEmployeesFromApi(
  config: SyncConfiguration,
  tenantId: number,
  employeeIdMap: Map<string, number>
): Promise<{ enriched: number; bankDetails: number; documents: number; employmentHistory: number; passportRecords: number; errors: string[] }> {
  const result = { enriched: 0, bankDetails: 0, documents: 0, employmentHistory: 0, passportRecords: 0, errors: [] as string[] };

  const apiBaseUrl = config.apiBaseUrl.replace(/\/api\/.*$/, "").replace(/\/$/, "");
  const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";

  let allEmployees: any[] = [];
  try {
    allEmployees = await fetchPaginated(apiBaseUrl, apiKey, "/api/employees.php", null, { api_key: apiKey });
  } catch (err: any) {
    try {
      allEmployees = await fetchPaginated(apiBaseUrl, apiKey, "/api/employees", null, { api_key: apiKey });
    } catch {
      result.errors.push(`Failed to fetch employees API: ${err.message}`);
      return result;
    }
  }

  for (const emp of allEmployees) {
    try {
      const extId = stripEntityPrefix(String(emp.id || emp.employeeId || ""));
      if (!extId) continue;

      let empId = employeeIdMap.get(extId);
      if (!empId) {
        const empRow = await pool.query(
          `SELECT id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
          [tenantId, extId]
        );
        if (empRow.rows.length > 0) empId = empRow.rows[0].id;
      }
      if (!empId) continue;

      if (emp.telephone) {
        const empRow2 = await pool.query(`SELECT user_id FROM employees WHERE id = $1`, [empId]);
        if (empRow2.rows[0]?.user_id) {
          await pool.query(`UPDATE users SET phone = $1 WHERE id = $2`, [emp.telephone, empRow2.rows[0].user_id]);
        }
      }

      if (emp.employeeEmail) {
        const empRow3 = await pool.query(`SELECT user_id FROM employees WHERE id = $1`, [empId]);
        if (empRow3.rows[0]?.user_id) {
          const cleanEmail = emp.employeeEmail.trim().toLowerCase();
          await pool.query(
            `UPDATE users SET email = $1, username = $1 WHERE id = $2`,
            [cleanEmail, empRow3.rows[0].user_id]
          );
        }
      }

      const empUpdate = buildFillBlanksUpdate("employees", {
        dateOfBirth: { dbField: "date_of_birth", value: sanitizeDate(emp.dob) },
        nationalInsurance: { dbField: "national_insurance", value: emp.ni_number },
        addressLine1: { dbField: "address_line_1", value: emp.add1 },
        addressLine2: { dbField: "address_line_2", value: emp.add2 },
        city: { dbField: "city", value: emp.city },
        county: { dbField: "county", value: emp.county },
        postcode: { dbField: "postcode", value: emp.postcode },
        gender: { dbField: "gender", value: emp.gender },
        nationality: { dbField: "nationality", value: emp.nationality },
        placeOfBirth: { dbField: "place_of_birth", value: emp.placeOfBirth || emp.place_of_birth },
        siaLicenseNumber: { dbField: "sia_license_number", value: emp.sia },
        siaExpiryDate: { dbField: "sia_expiry_date", value: sanitizeDate(emp.siaexp) },
      }, {}, empId);
      if (empUpdate?.hasFieldUpdates) {
        await pool.query(empUpdate.sql, empUpdate.values);
      }

      if (emp.bankname || emp.sortcode || emp.account) {
        const bankSynced = await syncEmployeeBankDetails(empId, {
          bankname: emp.bankname, acctitle: emp.acctitle,
          sortcode: emp.sortcode, account: emp.account,
        });
        if (bankSynced) result.bankDetails++;
      }

      if (emp.documentData && Array.isArray(emp.documentData) && emp.documentData.length > 0) {
        const docCount = await syncEmployeeDocuments(empId, tenantId, emp.documentData);
        result.documents += docCount;
      }

      if (emp.employmentHistory && Array.isArray(emp.employmentHistory) && emp.employmentHistory.length > 0) {
        const histCount = await syncEmploymentHistory(empId, emp.employmentHistory);
        result.employmentHistory += histCount;
      }

      if (emp.passportData) {
        const passCount = await syncPassportData(empId, tenantId, emp.passportData);
        result.passportRecords += passCount;
      }

      result.enriched++;
    } catch (empErr: any) {
      if (result.errors.length < 10) {
        result.errors.push(`Employee ${emp.id || "unknown"}: ${empErr.message}`);
      }
    }
  }

  return result;
}

export async function testConnection(config: SyncConfiguration): Promise<{ success: boolean; message: string }> {
  try {
    if (isPhpEmployeesApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      const url = `${config.apiBaseUrl.replace(/\/$/, "")}?api_key=${encodeURIComponent(apiKey)}&page=1&per_page=10`;
      const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return { success: false, message: `API returned status ${response.status}` };
      const body = await response.json();
      const totalRecords = body.pagination?.total_records || (Array.isArray(body.data) ? body.data.length : 0);
      return { success: true, message: `Connected successfully (PHP Employees API, ${totalRecords} employees available)` };
    }

    if (isRestPhpApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      const today = new Date().toISOString().split("T")[0];
      const data = await fetchFromRestPhpApi(config.apiBaseUrl, apiKey, today, today);
      return { success: true, message: `Connected successfully (REST Paginated API, ${data.length} shifts found for today)` };
    }

    if (isPhpApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      const today = new Date().toISOString().split("T")[0];
      const data = await fetchFromPhpApi(config.apiBaseUrl, apiKey, today, today);
      return { success: true, message: `Connected successfully (PHP API, ${data.length} shifts found for today)` };
    }

    const url = `${config.apiBaseUrl.replace(/\/$/, "")}/api/health`;
    const response = await fetch(url, {
      headers: {
        "X-API-Key": config.apiKeyEncrypted,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, message: `API returned status ${response.status}` };
    }

    const body = await response.json();
    if (body.status === "ok") {
      return { success: true, message: `Connected successfully (v${body.version || "unknown"})` };
    }
    return { success: false, message: "Health check did not return status ok" };
  } catch (err: any) {
    return { success: false, message: err.message || "Connection failed" };
  }
}

export async function runSync(
  configId: number,
  tenantId: number,
  entityType?: string,
  dateFrom?: string,
  dateTo?: string,
  supplierId?: string,
  siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>,
  pageFrom?: number,
  pageTo?: number
): Promise<SyncLog> {
  const config = await storage.getSyncConfiguration(configId);
  if (!config) throw new Error("Sync configuration not found");
  if (config.tenantId !== tenantId) throw new Error("Unauthorized");

  const log = await storage.createSyncLog({
    tenantId,
    configId,
    syncType: entityType || "all",
    status: "running",
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
  });

  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalFailed = 0;
  const allErrors: string[] = [];

  try {
    if (needsDateRange(config)) {
      if (!dateFrom || !dateTo) throw new Error("Date range (dateFrom/dateTo) is required for this API");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        throw new Error("dateFrom and dateTo must be in YYYY-MM-DD format");
      }
      if (dateFrom > dateTo) throw new Error("dateFrom must be before or equal to dateTo");
    }

    const breakdown: EntityBreakdown = {};

    if (isPhpEmployeesApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      const allEmployees: any[] = [];
      const startPage = pageFrom && pageFrom >= 1 ? pageFrom : 1;
      let empPage = startPage;
      let empTotalPages = pageTo || 999999;
      while (empPage <= empTotalPages) {
        let retries = 5;
        while (retries > 0) {
          try {
            if (empPage > startPage) await new Promise(r => setTimeout(r, 300));
            const url = `${config.apiBaseUrl.replace(/\/$/, "")}?api_key=${encodeURIComponent(apiKey)}&page=${empPage}&per_page=200`;
            const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (!text || text.length < 2) throw new Error("Empty response");
            const body = JSON.parse(text);
            const pageData = body.data || body;
            if (Array.isArray(pageData)) allEmployees.push(...pageData);
            if (body.pagination) {
              const serverTotalPages = body.pagination.total_pages || 1;
              empTotalPages = pageTo ? Math.min(pageTo, serverTotalPages) : serverTotalPages;
            }
            break;
          } catch (err: any) {
            retries--;
            if (retries === 0) { allErrors.push(`Page ${empPage} skipped: ${err.message}`); }
            else { await new Promise(r => setTimeout(r, 3000)); }
          }
        }
        empPage++;
      }
      if (allEmployees.length === 0) throw new Error("No employees fetched from API (pages " + startPage + "-" + empTotalPages + ")");

      breakdown.employees = newEntitySyncResult();
      const entityResult = breakdown.employees;

      for (const emp of allEmployees) {
        const extId = stripEntityPrefix(String(emp.id));
        let empSupplierId: number | null = null;
        if (emp.supplierId || emp.SupplierID) {
          const supExtId = stripEntityPrefix(String(emp.supplierId || emp.SupplierID));
          const sr = await findByExternalId(tenantId, "suppliers", supExtId);
          if (sr) {
            empSupplierId = sr.id;
          } else if (emp.supplierName || emp.SupplierName) {
            if (!breakdown.suppliers) breakdown.suppliers = newEntitySyncResult();
            empSupplierId = await upsertSupplier(tenantId, supExtId, { companyName: emp.supplierName || emp.SupplierName }, breakdown.suppliers);
          }
        }

        const { empId } = await upsertEmployee(tenantId, extId, emp, empSupplierId, entityResult);
        if (empId) {
          try {
            if (emp.telephone || emp.employeeEmail) {
              const empUserRow = await pool.query(`SELECT user_id FROM employees WHERE id = $1`, [empId]);
              const empUserId = empUserRow.rows[0]?.user_id;
              if (empUserId) {
                if (emp.telephone) {
                  await pool.query(`UPDATE users SET phone = $1 WHERE id = $2`, [emp.telephone, empUserId]);
                }
                if (emp.employeeEmail) {
                  const cleanEmail = emp.employeeEmail.trim().toLowerCase();
                  await pool.query(
                    `UPDATE users SET email = $1, username = $1 WHERE id = $2`,
                    [cleanEmail, empUserId]
                  );
                }
              }
            }
            if (emp.bankname || emp.sortcode || emp.account) {
              await syncEmployeeBankDetails(empId, {
                bankname: emp.bankname, acctitle: emp.acctitle,
                sortcode: emp.sortcode, account: emp.account,
              });
            }
            if (emp.documentData && Array.isArray(emp.documentData) && emp.documentData.length > 0) {
              await syncEmployeeDocuments(empId, tenantId, emp.documentData);
            }
            if (emp.employmentHistory && Array.isArray(emp.employmentHistory) && emp.employmentHistory.length > 0) {
              await syncEmploymentHistory(empId, emp.employmentHistory);
            }
            if (emp.passportData) {
              await syncPassportData(empId, tenantId, emp.passportData);
            }
          } catch {}
        }
      }
    } else if (isRestPhpApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      let shifts = await fetchFromRestPhpApi(config.apiBaseUrl, apiKey, dateFrom!, dateTo!, supplierId);
      if (supplierId) {
        shifts = shifts.filter(s => stripEntityPrefix(String(s.supplierId || "")) === supplierId);
      }
      const entities = extractEntitiesFromRestPhpShifts(shifts);

      breakdown.clients = newEntitySyncResult();
      const clientIdMap = new Map<string, number>();
      for (const [extId, name] of entities.clients) {
        const id = await upsertClient(tenantId, extId, { companyName: name }, breakdown.clients);
        if (id) clientIdMap.set(extId, id);
      }

      breakdown.sites = newEntitySyncResult();
      const siteIdMap = new Map<string, number>();
      for (const [extId, info] of entities.sites) {
        const clientId = clientIdMap.get(info.clientExtId) || null;
        const id = await upsertSite(tenantId, extId, { name: info.name }, clientId, breakdown.sites, siteDecisions);
        if (id) siteIdMap.set(extId, id);
      }

      breakdown.suppliers = newEntitySyncResult();
      const supplierIdMap = new Map<string, number>();
      for (const [extId, name] of entities.suppliers) {
        const id = await upsertSupplier(tenantId, extId, { companyName: name }, breakdown.suppliers);
        if (id) supplierIdMap.set(extId, id);
      }

      breakdown.employees = newEntitySyncResult();
      const employeeIdMap = new Map<string, number>();
      for (const [extId, info] of entities.employees) {
        const supId = supplierIdMap.get(info.supplierExtId) || null;
        const empData: Record<string, any> = { fullName: info.name };
        if (info.email) empData.email = info.email;
        const { empId } = await upsertEmployee(tenantId, extId, empData, supId, breakdown.employees);
        if (empId) employeeIdMap.set(extId, empId);
      }

      breakdown.shifts = newEntitySyncResult();
      const shiftResult = await syncRestPhpShifts(tenantId, shifts, supplierIdMap, clientIdMap, siteIdMap, employeeIdMap);
      breakdown.shifts = shiftResult;

      try {
        const enrichResult = await enrichEmployeesFromApi(config, tenantId, employeeIdMap);
        if (enrichResult) {
          allErrors.push(`[ENRICHMENT] ${enrichResult.enriched} employees enriched: ${enrichResult.bankDetails} bank, ${enrichResult.documents} docs, ${enrichResult.employmentHistory} history, ${enrichResult.passportRecords} passport records`);
          if (enrichResult.errors.length > 0) {
            allErrors.push(...enrichResult.errors.map(e => `[ENRICHMENT ERROR] ${e}`));
          }
        }
      } catch (enrichErr: any) {
        allErrors.push(`Employee enrichment failed: ${enrichErr.message}`);
      }
    } else if (isPhpApi(config)) {
      const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
      let shifts = await fetchFromPhpApi(config.apiBaseUrl, apiKey, dateFrom!, dateTo!, supplierId);
      if (supplierId) {
        shifts = shifts.filter(s => String(s.SupplierID || "") === supplierId);
      }
      const entities = extractEntitiesFromPhpShifts(shifts);

      breakdown.clients = newEntitySyncResult();
      const clientIdMap = new Map<string, number>();
      for (const [extId, name] of entities.clients) {
        const id = await upsertClient(tenantId, extId, { companyName: name }, breakdown.clients);
        if (id) clientIdMap.set(extId, id);
      }

      breakdown.sites = newEntitySyncResult();
      const siteIdMap = new Map<string, number>();
      for (const [extId, info] of entities.sites) {
        const clientId = clientIdMap.get(info.clientExtId) || null;
        const id = await upsertSite(tenantId, extId, { name: info.name }, clientId, breakdown.sites, siteDecisions);
        if (id) siteIdMap.set(extId, id);
      }

      breakdown.suppliers = newEntitySyncResult();
      const supplierIdMap = new Map<string, number>();
      for (const [extId, name] of entities.suppliers) {
        const id = await upsertSupplier(tenantId, extId, { companyName: name }, breakdown.suppliers);
        if (id) supplierIdMap.set(extId, id);
      }

      breakdown.employees = newEntitySyncResult();
      const employeeIdMap = new Map<string, number>();
      for (const [extId, info] of entities.employees) {
        const supId = supplierIdMap.get(info.supplierExtId) || null;
        const { empId } = await upsertEmployee(tenantId, extId, { fullName: info.name }, supId, breakdown.employees);
        if (empId) employeeIdMap.set(extId, empId);
      }

      breakdown.shifts = newEntitySyncResult();
      const shiftResult = await syncPhpShifts(tenantId, shifts, supplierIdMap, clientIdMap, siteIdMap, employeeIdMap);
      breakdown.shifts = shiftResult;
    } else {
      const enabledEntities = config.syncEntities && config.syncEntities.length > 0
        ? config.syncEntities
        : [...DEPENDENCY_ORDER];
      const typesToSync = entityType
        ? [entityType]
        : DEPENDENCY_ORDER.filter(t => enabledEntities.includes(t));

      for (const type of typesToSync) {
        const endpointMap: Record<string, string> = {
          clients: "/api/clients",
          suppliers: "/api/suppliers",
          sites: "/api/sites",
          employees: "/api/employees",
          shifts: "/api/shifts",
        };

        const endpoint = endpointMap[type];
        if (!endpoint) continue;

        let data: any[];
        try {
          data = await fetchPaginated(
            config.apiBaseUrl,
            config.apiKeyEncrypted,
            endpoint,
            config.lastSyncAt
          );
        } catch (fetchErr: any) {
          const entityResult = newEntitySyncResult();
          entityResult.errors.push(`Failed to fetch ${type}: ${fetchErr.message}`);
          breakdown[type] = entityResult;
          allErrors.push(`[${type.toUpperCase()}] Fetch failed: ${fetchErr.message}`);
          continue;
        }

        const entityResult = newEntitySyncResult();
        breakdown[type] = entityResult;

        for (const item of data) {
          const extId = String(item.id);
          switch (type) {
            case "clients":
              await upsertClient(tenantId, extId, item, entityResult);
              break;
            case "suppliers":
              await upsertSupplier(tenantId, extId, item, entityResult);
              break;
            case "sites": {
              let clientId: number | null = null;
              if (item.clientId) {
                const cr = await findByExternalId(tenantId, "clients", String(item.clientId));
                if (cr) clientId = cr.id;
              }
              await upsertSite(tenantId, extId, item, clientId, entityResult, siteDecisions);
              break;
            }
            case "employees": {
              let supplierId: number | null = null;
              if (item.supplierId) {
                const supExtId = stripEntityPrefix(String(item.supplierId));
                const sr = await findByExternalId(tenantId, "suppliers", supExtId);
                if (sr) {
                  supplierId = sr.id;
                } else if (item.supplierName) {
                  const supplierResult = newEntitySyncResult();
                  supplierId = await upsertSupplier(tenantId, supExtId, { companyName: item.supplierName }, supplierResult);
                }
              }
              const { empId: enrichEmpId } = await upsertEmployee(tenantId, extId, item, supplierId, entityResult);
              if (enrichEmpId) {
                try {
                  if (item.telephone || item.employeeEmail) {
                    const empUserRow = await pool.query(`SELECT user_id FROM employees WHERE id = $1`, [enrichEmpId]);
                    const empUserId = empUserRow.rows[0]?.user_id;
                    if (empUserId) {
                      if (item.telephone) {
                        await pool.query(`UPDATE users SET phone = $1 WHERE id = $2`, [item.telephone, empUserId]);
                      }
                      if (item.employeeEmail) {
                        const cleanEmail = item.employeeEmail.trim().toLowerCase();
                        await pool.query(
                          `UPDATE users SET email = $1, username = $1 WHERE id = $2`,
                          [cleanEmail, empUserId]
                        );
                      }
                    }
                  }
                  if (item.bankname || item.sortcode || item.account) {
                    await syncEmployeeBankDetails(enrichEmpId, {
                      bankname: item.bankname, acctitle: item.acctitle,
                      sortcode: item.sortcode, account: item.account,
                    });
                  }
                  if (item.documentData && Array.isArray(item.documentData) && item.documentData.length > 0) {
                    await syncEmployeeDocuments(enrichEmpId, tenantId, item.documentData);
                  }
                  if (item.employmentHistory && Array.isArray(item.employmentHistory) && item.employmentHistory.length > 0) {
                    await syncEmploymentHistory(enrichEmpId, item.employmentHistory);
                  }
                  if (item.passportData) {
                    await syncPassportData(enrichEmpId, tenantId, item.passportData);
                  }
                } catch {}
              }
              break;
            }
            case "shifts": {
              let employeeId: number | null = null;
              let siteId: number | null = null;
              let shiftSupplierId: number | null = null;
              if (item.employeeId) {
                const empRow = await findByExternalId(tenantId, "employees", String(item.employeeId));
                if (empRow) employeeId = empRow.id;
              }
              if (item.siteId) {
                const siteRow = await findByExternalId(tenantId, "sites", String(item.siteId));
                if (siteRow) siteId = siteRow.id;
              }
              if (item.supplierId) {
                const supRow = await findByExternalId(tenantId, "suppliers", String(item.supplierId));
                if (supRow) shiftSupplierId = supRow.id;
              }
              const { isDuplicate } = await checkShiftDuplicate(tenantId, extId, employeeId, siteId, item.date, item.startTime, item.endTime);
              if (isDuplicate) {
                entityResult.skipped++;
              } else {
                try {
                  await pool.query(
                    `INSERT INTO shifts (tenant_id, employee_id, site_id, supplier_id, title, date, start_time, end_time, status, notes, external_id, last_synced_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
                    [tenantId, employeeId, siteId, shiftSupplierId, `Shift ${extId}`, item.date, item.startTime, item.endTime,
                     mapShiftStatus(item.status), item.notes || null, extId]
                  );
                  entityResult.created++;
                } catch (err: any) {
                  entityResult.failed++;
                  entityResult.errors.push(`Shift ${extId}: ${err.message}`);
                }
              }
              break;
            }
          }
        }
      }
    }

    const { totalCreated: tc, totalUpdated: tu, totalSkipped: ts, totalFailed: tf, allErrors: ae } = mergeResults(breakdown);
    totalCreated = tc; totalUpdated = tu; totalSkipped = ts; totalFailed = tf;
    allErrors.push(...ae);

    const updatedLog = await storage.updateSyncLog(log.id, {
      status: totalFailed > 0 ? (totalCreated > 0 || totalUpdated > 0 ? "completed_with_errors" : "failed") : "completed",
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsSkipped: totalSkipped,
      recordsFailed: totalFailed,
      errors: allErrors.length > 0 ? allErrors : null,
      entityBreakdown: breakdown,
      completedAt: new Date(),
    });

    await storage.updateSyncConfiguration(configId, { lastSyncAt: new Date() });

    return updatedLog || log;
  } catch (err: any) {
    const updatedLog = await storage.updateSyncLog(log.id, {
      status: "failed",
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsSkipped: totalSkipped,
      recordsFailed: totalFailed,
      errors: [...allErrors, err.message],
      completedAt: new Date(),
    });
    return updatedLog || log;
  }
}

export interface DryRunRecord {
  action: "create" | "update" | "skip";
  entity: string;
  externalId: string;
  name: string;
  fieldsToUpdate?: string[];
  reason?: string;
  potentialDuplicates?: Array<{ matchedId: number; matchedName: string; matchReason: string; score: number }>;
}

export interface DryRunResult {
  entityType: string;
  totalFetched: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  records: DryRunRecord[];
  error?: string;
}

async function dryRunEntity(
  tenantId: number,
  entityType: string,
  data: any[]
): Promise<DryRunResult> {
  const result: DryRunResult = {
    entityType,
    totalFetched: data.length,
    toCreate: 0,
    toUpdate: 0,
    toSkip: 0,
    records: [],
  };

  for (const item of data) {
    const extId = String(item.id);

    if (entityType === "clients") {
      const name = item.companyName || "(unnamed)";
      const existingRow = await findClientByNameOrExtId(tenantId, extId, item.companyName || "");
      if (existingRow) {
        const row = existingRow;
        const blanks: string[] = [];
        if (!row.contact_name && item.contactName) blanks.push("contactName");
        if (!row.contact_email && item.contactEmail) blanks.push("contactEmail");
        if (!row.contact_phone && item.contactPhone) blanks.push("contactPhone");
        if (!row.address && item.address) blanks.push("address");
        if (!row.postcode && item.postcode) blanks.push("postcode");
        if (!row.company_reg_number && item.companyRegNumber) blanks.push("companyRegNumber");
        if (!row.contract_ref && item.contractRef) blanks.push("contractRef");
        if (!row.external_id) blanks.push("externalId");

        if (blanks.length > 0) {
          result.toUpdate++;
          result.records.push({ action: "update", entity: "client", externalId: extId, name, fieldsToUpdate: blanks });
        } else {
          result.toSkip++;
          result.records.push({ action: "skip", entity: "client", externalId: extId, name, reason: "All fields populated" });
        }
      } else {
        result.toCreate++;
        result.records.push({ action: "create", entity: "client", externalId: extId, name });
      }
    }

    if (entityType === "suppliers") {
      const name = item.companyName || "(unnamed)";
      const existingSupplier = await findSupplierByNameOrExtId(tenantId, extId, item.companyName || "");
      if (existingSupplier) {
        const row = existingSupplier;
        const blanks: string[] = [];
        if (!row.contact_name && item.contactName) blanks.push("contactName");
        if (!row.email && item.email) blanks.push("email");
        if (!row.phone && item.phone) blanks.push("phone");
        if (!row.vat_number && item.vatNumber) blanks.push("vatNumber");
        if (!row.company_reg_number && item.companyRegNumber) blanks.push("companyRegNumber");
        if (!row.address && item.address) blanks.push("address");
        if (!row.bank_name && item.bankName) blanks.push("bankName");
        if (!row.account_number && item.accountNumber) blanks.push("accountNumber");
        if (!row.sort_code && item.sortCode) blanks.push("sortCode");
        if (!row.external_id) blanks.push("externalId");

        if (blanks.length > 0) {
          result.toUpdate++;
          result.records.push({ action: "update", entity: "supplier", externalId: extId, name, fieldsToUpdate: blanks });
        } else {
          result.toSkip++;
          result.records.push({ action: "skip", entity: "supplier", externalId: extId, name, reason: "All fields populated" });
        }
      } else {
        result.toCreate++;
        result.records.push({ action: "create", entity: "supplier", externalId: extId, name });
      }
    }

    if (entityType === "sites") {
      const name = item.name || "(unnamed)";
      const { row: existingRow, fuzzyMatches } = await findSiteByExtIdOrFuzzy(tenantId, extId, name);
      const potentialDuplicates = fuzzyMatches && fuzzyMatches.length > 0
        ? fuzzyMatches.map(m => ({ matchedId: m.siteId, matchedName: m.siteName, matchReason: m.matchReason, score: m.score }))
        : undefined;

      if (existingRow) {
        const row = existingRow;
        const blanks: string[] = [];
        if (!row.address && item.address) blanks.push("address");
        if (!row.city && item.city) blanks.push("city");
        if (!row.postcode && item.postcode) blanks.push("postcode");
        if (!row.latitude && item.latitude) blanks.push("latitude");
        if (!row.longitude && item.longitude) blanks.push("longitude");
        if (!row.contract_ref && item.contractRef) blanks.push("contractRef");
        if (!row.external_id) blanks.push("externalId");

        if (blanks.length > 0) {
          result.toUpdate++;
          result.records.push({ action: "update", entity: "site", externalId: extId, name, fieldsToUpdate: blanks, potentialDuplicates });
        } else {
          result.toSkip++;
          result.records.push({ action: "skip", entity: "site", externalId: extId, name, reason: potentialDuplicates ? "Fuzzy match found" : "All fields populated", potentialDuplicates });
        }
      } else {
        result.toCreate++;
        result.records.push({ action: "create", entity: "site", externalId: extId, name });
      }
    }

    if (entityType === "employees") {
      const firstName = item.firstName || (item.fullName ? item.fullName.trim().split(/\s+/)[0] : null) || (item.employeeName ? item.employeeName.trim().split(/\s+/)[0] : null);
      const lastName = item.lastName || (item.fullName ? item.fullName.trim().split(/\s+/).slice(1).join(" ") : null) || (item.employeeName ? item.employeeName.trim().split(/\s+/).slice(1).join(" ") : null);
      const name = `${firstName || ""} ${lastName || ""}`.trim() || "(unnamed)";
      const email = (item.email || item.employeeEmail || "").toLowerCase().trim();
      const cleanExtId = extId.replace(/^(EMP)-/i, "");
      if (!firstName || !lastName) {
        result.toSkip++;
        result.records.push({ action: "skip", entity: "employee", externalId: cleanExtId, name, reason: "Missing required fields (name/email)" });
        continue;
      }

      const { userId, empId } = await findEmployeeByExtIdOrName(tenantId, cleanExtId, firstName, lastName, email || undefined);

      if (userId) {
        const empResult = await pool.query(`SELECT id, date_of_birth, national_insurance, address_line_1, city, postcode, job_title, sia_license_number, external_id FROM employees WHERE user_id = $1 LIMIT 1`, [userId]);
        const blanks: string[] = [];
        if (empResult.rows.length > 0) {
          const emp = empResult.rows[0];
          if (!emp.date_of_birth && (item.dateOfBirth || item.dob)) blanks.push("dateOfBirth");
          if (!emp.national_insurance && (item.nationalInsurance || item.ni_number)) blanks.push("nationalInsurance");
          if (!emp.address_line_1 && (item.addressLine1 || item.add1)) blanks.push("addressLine1");
          if (!emp.city && item.city) blanks.push("city");
          if (!emp.postcode && item.postcode) blanks.push("postcode");
          if (!emp.job_title && item.jobTitle) blanks.push("jobTitle");
          if (!emp.sia_license_number && (item.siaLicenseNumber || item.sia)) blanks.push("siaLicenseNumber");
          if (!emp.external_id) blanks.push("externalId");
        }

        if (blanks.length > 0) {
          result.toUpdate++;
          result.records.push({ action: "update", entity: "employee", externalId: cleanExtId, name, fieldsToUpdate: blanks });
        } else {
          result.toSkip++;
          result.records.push({ action: "skip", entity: "employee", externalId: cleanExtId, name, reason: "All fields populated" });
        }
      } else {
        result.toCreate++;
        result.records.push({ action: "create", entity: "employee", externalId: cleanExtId, name });
      }
    }

    if (entityType === "shifts") {
      const name = `Shift on ${item.date || "?"} (${item.startTime || "?"}-${item.endTime || "?"})`;
      const empExtId = item.employeeId ? String(item.employeeId) : "";
      const siteExtId = item.siteId ? String(item.siteId) : "";
      const { empId: resolvedEmpId } = empExtId
        ? await findEmployeeByExtIdOrName(tenantId, empExtId, "", "", "")
        : { empId: null };
      const { row: siteMatch } = siteExtId
        ? await findSiteByExtIdOrFuzzy(tenantId, siteExtId, "")
        : { row: null };
      const resolvedSiteId = siteMatch?.id || null;

      const { isDuplicate } = await checkShiftDuplicate(tenantId, extId, resolvedEmpId, resolvedSiteId, item.date, item.startTime, item.endTime, true);
      if (isDuplicate) {
        result.toSkip++;
        result.records.push({ action: "skip", entity: "shift", externalId: extId, name, reason: "Already imported or composite match" });
      } else {
        result.toCreate++;
        result.records.push({ action: "create", entity: "shift", externalId: extId, name });
      }
    }
  }

  return result;
}

async function dryRunRestPhpShifts(tenantId: number, shifts: any[]): Promise<DryRunResult[]> {
  const entities = extractEntitiesFromRestPhpShifts(shifts);
  const results: DryRunResult[] = [];

  const clientResult: DryRunResult = { entityType: "clients", totalFetched: entities.clients.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, name] of entities.clients) {
    const existing = await findClientByNameOrExtId(tenantId, extId, name);
    if (existing) {
      clientResult.toSkip++;
      clientResult.records.push({ action: "skip", entity: "client", externalId: extId, name, reason: "Already exists" });
    } else {
      clientResult.toCreate++;
      clientResult.records.push({ action: "create", entity: "client", externalId: extId, name });
    }
  }
  results.push(clientResult);

  const siteResult: DryRunResult = { entityType: "sites", totalFetched: entities.sites.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, info] of entities.sites) {
    const { row: existing, fuzzyMatches } = await findSiteByExtIdOrFuzzy(tenantId, extId, info.name);
    if (existing) {
      siteResult.toSkip++;
      siteResult.records.push({ action: "skip", entity: "site", externalId: extId, name: info.name, reason: "Already exists" });
    } else if (fuzzyMatches && fuzzyMatches.length > 0) {
      siteResult.toSkip++;
      const potDups = fuzzyMatches.map(m => ({ matchedId: m.siteId, matchedName: m.siteName, matchReason: m.matchReason, score: m.score }));
      siteResult.records.push({ action: "skip", entity: "site", externalId: extId, name: info.name, reason: `Fuzzy match: ${fuzzyMatches[0].siteName} (${fuzzyMatches[0].matchReason})`, potentialDuplicates: potDups });
    } else {
      siteResult.toCreate++;
      siteResult.records.push({ action: "create", entity: "site", externalId: extId, name: info.name });
    }
  }
  results.push(siteResult);

  const supplierResult: DryRunResult = { entityType: "suppliers", totalFetched: entities.suppliers.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, name] of entities.suppliers) {
    const existing = await findSupplierByNameOrExtId(tenantId, extId, name);
    if (existing) {
      supplierResult.toSkip++;
      supplierResult.records.push({ action: "skip", entity: "supplier", externalId: extId, name, reason: "Already exists" });
    } else {
      supplierResult.toCreate++;
      supplierResult.records.push({ action: "create", entity: "supplier", externalId: extId, name });
    }
  }
  results.push(supplierResult);

  const employeeResult: DryRunResult = { entityType: "employees", totalFetched: entities.employees.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, info] of entities.employees) {
    const nameParts = info.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const existing = await findEmployeeByExtIdOrName(tenantId, extId, firstName, lastName);
    if (existing.userId) {
      if (existing.empId) {
        employeeResult.toUpdate++;
        employeeResult.records.push({ action: "update", entity: "employee", externalId: extId, name: info.name, fieldsToUpdate: ["externalId", "supplierId"] });
      } else {
        employeeResult.toSkip++;
        employeeResult.records.push({ action: "skip", entity: "employee", externalId: extId, name: info.name, reason: "Already exists" });
      }
    } else {
      employeeResult.toCreate++;
      employeeResult.records.push({ action: "create", entity: "employee", externalId: extId, name: info.name });
    }
  }
  results.push(employeeResult);

  const shiftResult: DryRunResult = { entityType: "shifts", totalFetched: shifts.length, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const item of shifts) {
    const extId = stripEntityPrefix(item.id);
    const name = `${item.siteName || item.siteId || "Shift"} on ${item.date || "?"} (${item.startTime || "?"}-${item.endTime || "?"})`;

    const empExtId = stripEntityPrefix(item.employeeId || "");
    const siteExtId = stripEntityPrefix(item.siteId || "");

    let resolvedEmpId: number | null = null;
    const empMatch = await findEmployeeByExtIdOrName(tenantId, empExtId, "", "");
    if (empMatch.empId) {
      resolvedEmpId = empMatch.empId;
    } else if (item.employeeName) {
      const np = item.employeeName.trim().split(/\s+/);
      const nameMatch = await findEmployeeByExtIdOrName(tenantId, "", np[0] || "", np.slice(1).join(" ") || "");
      if (nameMatch.empId) resolvedEmpId = nameMatch.empId;
    }

    let resolvedSiteId: number | null = null;
    const { row: siteMatch } = await findSiteByExtIdOrFuzzy(tenantId, siteExtId, item.siteName || "");
    if (siteMatch) resolvedSiteId = siteMatch.id;

    const { isDuplicate } = await checkShiftDuplicate(tenantId, extId, resolvedEmpId, resolvedSiteId, item.date, item.startTime, item.endTime, true);
    if (isDuplicate) {
      shiftResult.toSkip++;
      shiftResult.records.push({ action: "skip", entity: "shift", externalId: extId, name, reason: "Already imported or composite match" });
    } else {
      shiftResult.toCreate++;
      shiftResult.records.push({ action: "create", entity: "shift", externalId: extId, name });
    }
  }
  results.push(shiftResult);

  return results;
}

async function dryRunPhpShifts(tenantId: number, shifts: any[]): Promise<DryRunResult[]> {
  const entities = extractEntitiesFromPhpShifts(shifts);
  const results: DryRunResult[] = [];

  const clientResult: DryRunResult = { entityType: "clients", totalFetched: entities.clients.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, name] of entities.clients) {
    const existing = await findClientByNameOrExtId(tenantId, extId, name);
    if (existing) {
      if (!existing.external_id) {
        clientResult.toUpdate++;
        clientResult.records.push({ action: "update", entity: "client", externalId: extId, name, fieldsToUpdate: ["externalId"] });
      } else {
        clientResult.toSkip++;
        clientResult.records.push({ action: "skip", entity: "client", externalId: extId, name, reason: "Already exists" });
      }
    } else {
      clientResult.toCreate++;
      clientResult.records.push({ action: "create", entity: "client", externalId: extId, name });
    }
  }
  results.push(clientResult);

  const siteResult: DryRunResult = { entityType: "sites", totalFetched: entities.sites.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, info] of entities.sites) {
    const { row: existing, fuzzyMatches } = await findSiteByExtIdOrFuzzy(tenantId, extId, info.name);
    if (existing) {
      if (!existing.external_id) {
        siteResult.toUpdate++;
        siteResult.records.push({ action: "update", entity: "site", externalId: extId, name: info.name, fieldsToUpdate: ["externalId"] });
      } else {
        siteResult.toSkip++;
        siteResult.records.push({ action: "skip", entity: "site", externalId: extId, name: info.name, reason: "Already exists" });
      }
    } else if (fuzzyMatches && fuzzyMatches.length > 0) {
      siteResult.toSkip++;
      const potDups = fuzzyMatches.map(m => ({ matchedId: m.siteId, matchedName: m.siteName, matchReason: m.matchReason, score: m.score }));
      siteResult.records.push({ action: "skip", entity: "site", externalId: extId, name: info.name, reason: `Fuzzy match: ${fuzzyMatches[0].siteName} (${fuzzyMatches[0].matchReason})`, potentialDuplicates: potDups });
    } else {
      siteResult.toCreate++;
      siteResult.records.push({ action: "create", entity: "site", externalId: extId, name: info.name });
    }
  }
  results.push(siteResult);

  const supplierResult: DryRunResult = { entityType: "suppliers", totalFetched: entities.suppliers.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, name] of entities.suppliers) {
    const existing = await findSupplierByNameOrExtId(tenantId, extId, name);
    if (existing) {
      if (!existing.external_id) {
        supplierResult.toUpdate++;
        supplierResult.records.push({ action: "update", entity: "supplier", externalId: extId, name, fieldsToUpdate: ["externalId"] });
      } else {
        supplierResult.toSkip++;
        supplierResult.records.push({ action: "skip", entity: "supplier", externalId: extId, name, reason: "Already exists" });
      }
    } else {
      supplierResult.toCreate++;
      supplierResult.records.push({ action: "create", entity: "supplier", externalId: extId, name });
    }
  }
  results.push(supplierResult);

  const employeeResult: DryRunResult = { entityType: "employees", totalFetched: entities.employees.size, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const [extId, info] of entities.employees) {
    const nameParts = info.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const existing = await findEmployeeByExtIdOrName(tenantId, extId, firstName, lastName);
    if (existing.userId) {
      if (existing.empId) {
        employeeResult.toUpdate++;
        employeeResult.records.push({ action: "update", entity: "employee", externalId: extId, name: info.name, fieldsToUpdate: ["externalId", "supplierId"] });
      } else {
        employeeResult.toSkip++;
        employeeResult.records.push({ action: "skip", entity: "employee", externalId: extId, name: info.name, reason: "Already exists" });
      }
    } else {
      employeeResult.toCreate++;
      employeeResult.records.push({ action: "create", entity: "employee", externalId: extId, name: info.name });
    }
  }
  results.push(employeeResult);

  const shiftResult: DryRunResult = { entityType: "shifts", totalFetched: shifts.length, toCreate: 0, toUpdate: 0, toSkip: 0, records: [] };
  for (const item of shifts) {
    const extId = String(item.shift_id);
    const name = `Shift on ${item.shift_date || "?"} (${item.time_start || "?"}-${item.time_finish || "?"})`;

    const empExtId = String(item.officer_id || "");
    let resolvedEmpId: number | null = null;
    const empMatch = await findEmployeeByExtIdOrName(tenantId, empExtId, "", "");
    if (empMatch.empId) {
      resolvedEmpId = empMatch.empId;
    } else {
      const officerName = `${item.officer_first_name || ""} ${item.officer_last_name || ""}`.trim();
      if (officerName) {
        const np = officerName.split(/\s+/);
        const nameMatch = await findEmployeeByExtIdOrName(tenantId, "", np[0] || "", np.slice(1).join(" ") || "");
        if (nameMatch.empId) resolvedEmpId = nameMatch.empId;
      }
    }

    const siteExtId = String(item.LocationID || "");
    const siteName = item.LocationName || item.site_name || "";
    const { row: siteMatch } = await findSiteByExtIdOrFuzzy(tenantId, siteExtId, siteName);
    const resolvedSiteId = siteMatch?.id || null;

    const { isDuplicate } = await checkShiftDuplicate(tenantId, extId, resolvedEmpId, resolvedSiteId, item.shift_date, item.time_start, item.time_finish, true);
    if (isDuplicate) {
      shiftResult.toSkip++;
      shiftResult.records.push({ action: "skip", entity: "shift", externalId: extId, name, reason: "Already imported or composite match" });
    } else {
      shiftResult.toCreate++;
      shiftResult.records.push({ action: "create", entity: "shift", externalId: extId, name });
    }
  }
  results.push(shiftResult);

  return results;
}

export async function runDrySync(
  configId: number,
  tenantId: number,
  entityType?: string,
  dateFrom?: string,
  dateTo?: string,
  supplierId?: string,
  pageFrom?: number,
  pageTo?: number
): Promise<DryRunResult[]> {
  const config = await storage.getSyncConfiguration(configId);
  if (!config) throw new Error("Sync configuration not found");
  if (config.tenantId !== tenantId) throw new Error("Unauthorized");

  if (needsDateRange(config)) {
    if (!dateFrom || !dateTo) throw new Error("Date range (dateFrom/dateTo) is required for this API");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw new Error("dateFrom and dateTo must be in YYYY-MM-DD format");
    }
    if (dateFrom > dateTo) throw new Error("dateFrom must be before or equal to dateTo");
  }

  if (isPhpEmployeesApi(config)) {
    const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
    const allData: any[] = [];
    const startPage = pageFrom && pageFrom >= 1 ? pageFrom : 1;
    let currentPage = startPage;
    let maxPage = pageTo || startPage;
    let totalRecords = 0;
    while (currentPage <= maxPage) {
      try {
        if (currentPage > startPage) await new Promise(r => setTimeout(r, 300));
        const url = `${config.apiBaseUrl.replace(/\/$/, "")}?api_key=${encodeURIComponent(apiKey)}&page=${currentPage}&per_page=200`;
        const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Employees API returned status ${response.status}`);
        const body = await response.json();
        const pageData: any[] = body.data || body;
        if (Array.isArray(pageData)) allData.push(...pageData);
        if (body.pagination) {
          totalRecords = body.pagination.total_records || 0;
          if (pageTo) maxPage = Math.min(pageTo, body.pagination.total_pages || 1);
          else maxPage = currentPage;
        }
      } catch (err: any) {
        break;
      }
      currentPage++;
    }
    const dryResult = await dryRunEntity(tenantId, "employees", allData);
    dryResult.totalFetched = allData.length;
    return [dryResult];
  }

  if (isRestPhpApi(config)) {
    const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
    let shifts = await fetchFromRestPhpApi(config.apiBaseUrl, apiKey, dateFrom!, dateTo!, supplierId);
    if (supplierId) {
      shifts = shifts.filter(s => stripEntityPrefix(String(s.supplierId || "")) === supplierId);
    }
    return dryRunRestPhpShifts(tenantId, shifts);
  }

  if (isPhpApi(config)) {
    const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";
    let shifts = await fetchFromPhpApi(config.apiBaseUrl, apiKey, dateFrom!, dateTo!, supplierId);
    if (supplierId) {
      shifts = shifts.filter(s => String(s.SupplierID || "") === supplierId);
    }
    return dryRunPhpShifts(tenantId, shifts);
  }

  const enabledEntities = config.syncEntities && config.syncEntities.length > 0
    ? config.syncEntities
    : [...DEPENDENCY_ORDER];
  const typesToSync = entityType
    ? [entityType]
    : DEPENDENCY_ORDER.filter(t => enabledEntities.includes(t));

  const results: DryRunResult[] = [];

  const endpointMap: Record<string, string> = {
    clients: "/api/clients",
    suppliers: "/api/suppliers",
    sites: "/api/sites",
    employees: "/api/employees",
    shifts: "/api/shifts",
  };

  for (const type of typesToSync) {
    const endpoint = endpointMap[type];
    if (!endpoint) continue;

    let data: any[];
    try {
      data = await fetchPaginated(
        config.apiBaseUrl,
        config.apiKeyEncrypted,
        endpoint,
        config.lastSyncAt
      );
    } catch (fetchErr: any) {
      results.push({ entityType: type, totalFetched: 0, toCreate: 0, toUpdate: 0, toSkip: 0, records: [], error: `Fetch failed: ${fetchErr.message}` });
      continue;
    }

    const dryResult = await dryRunEntity(tenantId, type, data);
    results.push(dryResult);
  }

  return results;
}

export interface BackfillSiteMatch {
  localSiteId: number;
  localSiteName: string;
  localExternalId: string | null;
  externalSiteId: string;
  externalSiteName: string;
  matchScore: number;
  matchReason: string;
}

export interface BackfillSiteResult {
  matched: BackfillSiteMatch[];
  unmatched: Array<{ localSiteId: number; localSiteName: string }>;
  totalLocal: number;
  totalExternal: number;
}

export async function backfillSiteExternalIds(
  configId: number,
  tenantId: number,
  minScore: number = 70,
  dryRun: boolean = true
): Promise<BackfillSiteResult> {
  const config = await storage.getSyncConfiguration(configId);
  if (!config) throw new Error("Sync configuration not found");
  if (config.tenantId !== tenantId) throw new Error("Unauthorized");

  const externalSites = await fetchPaginated(
    config.apiBaseUrl,
    config.apiKeyEncrypted,
    "/api/sites"
  );

  const localResult = await pool.query(
    `SELECT id, name, postcode, external_id FROM sites WHERE tenant_id = $1 AND external_id IS NULL ORDER BY name`,
    [tenantId]
  );
  const localSites: Array<{ id: number; name: string; postcode: string | null; external_id: string | null }> = localResult.rows;

  const matched: BackfillSiteMatch[] = [];
  const matchedLocalIds = new Set<number>();

  for (const extSite of externalSites) {
    const extId = String(extSite.id);
    const extName = extSite.name || "";
    if (!extName) continue;

    const candidates = localSites.filter(s => !matchedLocalIds.has(s.id));
    const fuzzyMatches = findFuzzySiteMatches(extName, candidates.map(s => ({ id: s.id, name: s.name, postcode: s.postcode })));

    const best = fuzzyMatches.find(m => m.score >= minScore);
    if (best) {
      matched.push({
        localSiteId: best.siteId,
        localSiteName: best.siteName,
        localExternalId: null,
        externalSiteId: extId,
        externalSiteName: extName,
        matchScore: best.score,
        matchReason: best.matchReason,
      });
      matchedLocalIds.add(best.siteId);

    }
  }

  if (!dryRun && matched.length > 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const m of matched) {
        await client.query(
          `UPDATE sites SET external_id = $1, last_synced_at = NOW() WHERE id = $2 AND tenant_id = $3`,
          [m.externalSiteId, m.localSiteId, tenantId]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  const unmatched = localSites
    .filter(s => !matchedLocalIds.has(s.id))
    .map(s => ({ localSiteId: s.id, localSiteName: s.name }));

  return {
    matched,
    unmatched,
    totalLocal: localSites.length,
    totalExternal: externalSites.length,
  };
}

export async function backfillUnassignedShifts(
  configId: number,
  tenantId: number,
  dryRun: boolean = true,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  dryRun: boolean;
  totalUnassigned: number;
  matched: number;
  employeesCreated: number;
  notFound: number;
  noExtEmployee: number;
  sampleMatches: any[];
}> {
  const config = await storage.getSyncConfiguration(configId);
  if (!config) throw new Error("Sync configuration not found");
  if (config.tenantId !== tenantId) throw new Error("Unauthorized");

  const unassignedResult = await pool.query(
    `SELECT s.id, s.external_id
     FROM shifts s
     WHERE s.tenant_id = $1 AND s.employee_id IS NULL AND s.external_id IS NOT NULL
     ORDER BY s.id`,
    [tenantId]
  );

  const unassignedShifts = unassignedResult.rows;
  if (unassignedShifts.length === 0) {
    return { dryRun, totalUnassigned: 0, matched: 0, employeesCreated: 0, notFound: 0, noExtEmployee: 0, sampleMatches: [] };
  }

  const unassignedByExtId = new Map<string, number[]>();
  for (const s of unassignedShifts) {
    const extId = String(s.external_id);
    if (!unassignedByExtId.has(extId)) unassignedByExtId.set(extId, []);
    unassignedByExtId.get(extId)!.push(s.id);
  }

  let apiShifts: any[] = [];
  const apiKey = config.apiKeyEncrypted || process.env.EXTERNAL_SYNC_API_KEY || "";

  if (isRestPhpApi(config)) {
    const from = dateFrom || "2020-01-01";
    const to = dateTo || new Date().toISOString().split("T")[0];
    apiShifts = await fetchFromRestPhpApi(config.apiBaseUrl, apiKey, from, to);
  } else if (isPhpApi(config)) {
    const from = dateFrom || "2020-01-01";
    const to = dateTo || new Date().toISOString().split("T")[0];
    apiShifts = await fetchFromPhpApi(config.apiBaseUrl, apiKey, from, to);
  } else {
    throw new Error("Unsupported API type for backfill");
  }

  const shiftToEmployee = new Map<string, { empExtId: string; empName: string; empEmail: string; supplierExtId: string }>();
  const allEmployees = new Map<string, { name: string; email: string; supplierExtId: string }>();

  if (isRestPhpApi(config)) {
    for (const s of apiShifts) {
      const shiftExtId = stripEntityPrefix(s.id);
      const empExtId = s.employeeId ? stripEntityPrefix(s.employeeId) : null;
      if (empExtId && unassignedByExtId.has(shiftExtId)) {
        shiftToEmployee.set(shiftExtId, {
          empExtId,
          empName: s.employeeName || empExtId,
          empEmail: (s.employeeEmail || "").trim(),
          supplierExtId: s.supplierId ? stripEntityPrefix(s.supplierId) : "",
        });
        allEmployees.set(empExtId, {
          name: s.employeeName || empExtId,
          email: (s.employeeEmail || "").trim(),
          supplierExtId: s.supplierId ? stripEntityPrefix(s.supplierId) : "",
        });
      }
    }
  } else {
    for (const s of apiShifts) {
      const shiftExtId = String(s.ShiftID || s.id || "");
      const empExtId = String(s.officer_id || "");
      if (empExtId && unassignedByExtId.has(shiftExtId)) {
        shiftToEmployee.set(shiftExtId, {
          empExtId,
          empName: s.officer_name || empExtId,
          empEmail: "",
          supplierExtId: String(s.SupplierID || ""),
        });
        allEmployees.set(empExtId, {
          name: s.officer_name || empExtId,
          email: "",
          supplierExtId: String(s.SupplierID || ""),
        });
      }
    }
  }

  let matched = 0, employeesCreated = 0, notFound = 0, noExtEmployee = 0;
  const details: any[] = [];
  const dummyResult = newEntitySyncResult();

  for (const [shiftExtId, shiftIds] of unassignedByExtId) {
    const empInfo = shiftToEmployee.get(shiftExtId);
    if (!empInfo) {
      noExtEmployee += shiftIds.length;
      continue;
    }

    let empResult = await pool.query(
      `SELECT id FROM employees WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
      [tenantId, empInfo.empExtId]
    );

    if (empResult.rows.length === 0 && !dryRun) {
      const supResult = await pool.query(
        `SELECT id FROM suppliers WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenantId, empInfo.supplierExtId]
      );
      const supplierId = supResult.rows[0]?.id || null;
      const empData: Record<string, any> = { fullName: empInfo.empName };
      if (empInfo.empEmail) empData.email = empInfo.empEmail;
      const { empId } = await upsertEmployee(tenantId, empInfo.empExtId, empData, supplierId, dummyResult);
      if (empId) {
        employeesCreated++;
        empResult = { rows: [{ id: empId }] } as any;
      }
    } else if (empResult.rows.length === 0 && dryRun) {
      employeesCreated += shiftIds.length;
      matched += shiftIds.length;
      if (details.length < 20) {
        details.push({ shiftId: shiftIds[0], employeeExtId: empInfo.empExtId, action: "would_create_employee_and_link" });
      }
      continue;
    }

    if (empResult.rows.length > 0) {
      const empId = empResult.rows[0].id;
      for (const shiftId of shiftIds) {
        if (!dryRun) {
          await pool.query(`UPDATE shifts SET employee_id = $1 WHERE id = $2`, [empId, shiftId]);
        }
        matched++;
        if (details.length < 20) {
          details.push({ shiftId, employeeId: empId, employeeExtId: empInfo.empExtId });
        }
      }
    } else {
      notFound += shiftIds.length;
    }
  }

  return { dryRun, totalUnassigned: unassignedShifts.length, matched, employeesCreated, notFound, noExtEmployee, sampleMatches: details };
}
