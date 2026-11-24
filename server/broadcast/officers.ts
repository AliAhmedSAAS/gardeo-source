import { pool } from "../db";
import { sqlEmployeeIsInhouse } from "../payroll-control";
import type { LatLng } from "./geocode";

export type OfficerFilter = "all" | "previously_worked" | "car_owner" | "new";

export type OfficerSearchParams = {
  tenantId: number;
  center: LatLng;
  radiusMiles: number;
  siteId: number | null;
  filter: OfficerFilter;
  officerType: string | null;
  name: string | null;
};

export type BroadcastOfficer = {
  employeeId: number;
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  officerType: string | null;
  carOwner: boolean;
  distanceMiles: number;
  siteShifts: number;
  totalShifts: number;
  lastWorked: string | null;
  isNew: boolean;
};

const EARTH_RADIUS_MILES = 3958.8;
const MILES_PER_DEGREE_LAT = 69;
const NEW_OFFICER_DAYS = 30;
const MAX_RESULTS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAR_OWNER_SQL = `LOWER(TRIM(COALESCE(e.car_owner, ''))) IN ('yes', 'y', 'true', '1')`;

/** Converts UK mobile/landline input into E.164 for Twilio; null if unusable. */
export function toE164(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return /^\+\d{10,15}$/.test(s) ? s : null;
  if (s.startsWith("00")) return toE164(`+${s.slice(2)}`);
  if (s.startsWith("44") && s.length >= 12) return `+${s}`;
  if (s.startsWith("0") && s.length === 11) return `+44${s.slice(1)}`;
  if (s.startsWith("7") && s.length === 10) return `+44${s}`;
  return null;
}

export function cleanEmail(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  return EMAIL_RE.test(s) ? s : null;
}

const CONTACT_SELECT = `
  e.id AS employee_id,
  TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS name,
  u.email AS email,
  COALESCE(NULLIF(TRIM(e.phone), ''), NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(e.second_phone), '')) AS phone`;

const ELIGIBLE_WHERE = `
  e.tenant_id = $1
  AND COALESCE(e.is_merged, false) = false
  AND ${sqlEmployeeIsInhouse("e")}
  AND (e.contract_end_date IS NULL OR e.contract_end_date >= CURRENT_DATE)`;

export async function searchOfficers(p: OfficerSearchParams): Promise<{ officers: BroadcastOfficer[]; truncated: boolean }> {
  const latDelta = p.radiusMiles / MILES_PER_DEGREE_LAT;
  const lngDelta = p.radiusMiles / (MILES_PER_DEGREE_LAT * Math.max(Math.cos((p.center.lat * Math.PI) / 180), 0.01));

  const params: unknown[] = [p.tenantId, p.center.lat, p.center.lng, p.radiusMiles, latDelta, lngDelta, p.siteId];
  const outer: string[] = ["n.distance_miles <= $4"];

  if (p.filter === "previously_worked") outer.push("COALESCE(w.site_shifts, 0) > 0");
  if (p.filter === "car_owner") outer.push("n.car_owner");
  if (p.filter === "new") outer.push(`(n.created_at >= NOW() - INTERVAL '${NEW_OFFICER_DAYS} days' OR COALESCE(w.total_shifts, 0) = 0)`);
  if (p.officerType) {
    params.push(p.officerType.trim().toLowerCase());
    outer.push(`LOWER(TRIM(COALESCE(n.officer_type, ''))) = $${params.length}`);
  }
  if (p.name) {
    params.push(`%${p.name.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    outer.push(`n.name ILIKE $${params.length}`);
  }

  const { rows } = await pool.query(
    `WITH nearby AS (
       SELECT ${CONTACT_SELECT},
              e.postcode, e.officer_type, e.created_at,
              ${CAR_OWNER_SQL} AS car_owner,
              ${EARTH_RADIUS_MILES} * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(e.latitude::float8 - $2::float8) / 2), 2)
                + COS(RADIANS($2::float8)) * COS(RADIANS(e.latitude::float8))
                  * POWER(SIN(RADIANS(e.longitude::float8 - $3::float8) / 2), 2)
              )) AS distance_miles
         FROM employees e
         JOIN users u ON u.id = e.user_id
        WHERE ${ELIGIBLE_WHERE}
          AND e.latitude IS NOT NULL
          AND e.latitude BETWEEN $2::float8 - $5::float8 AND $2::float8 + $5::float8
          AND e.longitude BETWEEN $3::float8 - $6::float8 AND $3::float8 + $6::float8
     )
     SELECT n.*, w.site_shifts, w.total_shifts, w.last_worked
       FROM nearby n
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE sh.site_id = $7::int) AS site_shifts,
                COUNT(*) AS total_shifts,
                MAX(sh.date)::text AS last_worked
           FROM shifts sh
          WHERE sh.tenant_id = $1
            AND sh.employee_id = n.employee_id
            AND sh.status NOT IN ('cancelled', 'scheduled')
       ) w ON true
      WHERE ${outer.join(" AND ")}
      ORDER BY COALESCE(w.site_shifts, 0) > 0 DESC, n.distance_miles ASC
      LIMIT ${MAX_RESULTS + 1}`,
    params,
  );

  const cutoff = Date.now() - NEW_OFFICER_DAYS * 86_400_000;
  const officers = rows.slice(0, MAX_RESULTS).map((r: any): BroadcastOfficer => ({
    employeeId: r.employee_id,
    name: r.name || `Officer #${r.employee_id}`,
    email: cleanEmail(r.email),
    phone: toE164(r.phone),
    postcode: r.postcode || null,
    officerType: r.officer_type || null,
    carOwner: !!r.car_owner,
    distanceMiles: Math.round(Number(r.distance_miles) * 10) / 10,
    siteShifts: Number(r.site_shifts || 0),
    totalShifts: Number(r.total_shifts || 0),
    lastWorked: r.last_worked || null,
    isNew: Number(r.total_shifts || 0) === 0 || (r.created_at && new Date(r.created_at).getTime() >= cutoff),
  }));
  return { officers, truncated: rows.length > MAX_RESULTS };
}

/** Re-reads contact details server-side so the client cannot redirect messages to arbitrary addresses. */
export async function loadRecipientContacts(tenantId: number, employeeIds: number[]): Promise<Array<{
  employeeId: number;
  name: string;
  email: string | null;
  phone: string | null;
}>> {
  const { rows } = await pool.query(
    `SELECT ${CONTACT_SELECT}
       FROM employees e
       JOIN users u ON u.id = e.user_id
      WHERE ${ELIGIBLE_WHERE}
        AND e.id = ANY($2::int[])`,
    [tenantId, employeeIds],
  );
  return rows.map((r: any) => ({
    employeeId: r.employee_id,
    name: r.name || `Officer #${r.employee_id}`,
    email: cleanEmail(r.email),
    phone: toE164(r.phone),
  }));
}
