import { pool } from "../db";
import { sqlEmployeeIsInhouse } from "../payroll-control";

export type LatLng = { lat: number; lng: number };

const POSTCODES_API_URL = (process.env.POSTCODES_IO_URL || "https://api.postcodes.io").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;
const BULK_LIMIT = 100;
const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

const siteCenterCache = new Map<string, LatLng | null>();

/** Returns the canonical "OUTWARD INWARD" form, or null if the text is not a UK postcode. */
export function normalizePostcode(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toUpperCase();
  const m = s.match(new RegExp(`^${UK_POSTCODE_RE.source}$`, "i"));
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

/** Many synced sites have no postcode column but embed it in the name/address. */
export function extractPostcode(text: string | null | undefined): string | null {
  const m = String(text ?? "").toUpperCase().match(UK_POSTCODE_RE);
  return m ? `${m[1]} ${m[2]}` : null;
}

async function postJson(url: string, body: unknown): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status >= 500) throw new Error(`Postcode lookup failed (${res.status})`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Postcode lookup failed");
}

/** Bulk lookup via postcodes.io. Unknown postcodes map to null. */
export async function lookupPostcodes(postcodes: string[]): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  const unique = Array.from(new Set(postcodes));
  for (let i = 0; i < unique.length; i += BULK_LIMIT) {
    const batch = unique.slice(i, i + BULK_LIMIT);
    const json = await postJson(`${POSTCODES_API_URL}/postcodes`, { postcodes: batch });
    for (const item of json?.result ?? []) {
      const key = normalizePostcode(item?.query);
      if (!key) continue;
      const r = item?.result;
      out.set(key, r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        ? { lat: r.latitude, lng: r.longitude }
        : null);
    }
  }
  return out;
}

export async function lookupPostcode(postcode: string): Promise<LatLng | null> {
  const key = normalizePostcode(postcode);
  if (!key) return null;
  const map = await lookupPostcodes([key]);
  return map.get(key) ?? null;
}

export type SiteCenter = LatLng & { source: "site_coordinates" | "site_postcode" | "site_address"; postcode: string | null };

/** Site lat/lng first, then its postcode, then a postcode found in the address or name. */
export async function resolveSiteCenter(site: {
  latitude: string | null;
  longitude: string | null;
  postcode: string | null;
  address: string | null;
  name: string | null;
}): Promise<SiteCenter | null> {
  const lat = parseFloat(String(site.latitude ?? ""));
  const lng = parseFloat(String(site.longitude ?? ""));
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng, source: "site_coordinates", postcode: normalizePostcode(site.postcode) };
  }

  const candidates: Array<{ postcode: string | null; source: SiteCenter["source"] }> = [
    { postcode: normalizePostcode(site.postcode) ?? extractPostcode(site.postcode), source: "site_postcode" },
    { postcode: extractPostcode(site.address), source: "site_address" },
    { postcode: extractPostcode(site.name), source: "site_address" },
  ];
  for (const c of candidates) {
    if (!c.postcode) continue;
    let point = siteCenterCache.get(c.postcode);
    if (point === undefined) {
      point = await lookupPostcode(c.postcode);
      siteCenterCache.set(c.postcode, point);
    }
    if (point) return { ...point, source: c.source, postcode: c.postcode };
  }
  return null;
}

/**
 * Geocodes in-house officers whose postcode changed since the last lookup.
 * Failed lookups still record geocoded_postcode so they are not retried on every search.
 */
export async function geocodePendingEmployees(tenantId: number, maxRows = 2000): Promise<{ updated: number; remaining: number }> {
  const { rows } = await pool.query<{ id: number; postcode: string }>(
    `SELECT e.id, e.postcode
       FROM employees e
      WHERE e.tenant_id = $1
        AND COALESCE(e.is_merged, false) = false
        AND ${sqlEmployeeIsInhouse("e")}
        AND NULLIF(TRIM(e.postcode), '') IS NOT NULL
        AND e.geocoded_postcode IS DISTINCT FROM UPPER(TRIM(e.postcode))
      ORDER BY e.id
      LIMIT $2`,
    [tenantId, maxRows + 1],
  );
  const remaining = Math.max(0, rows.length - maxRows);
  const work = rows.slice(0, maxRows);
  if (work.length === 0) return { updated: 0, remaining: 0 };

  const normalized = work.map((r) => normalizePostcode(r.postcode));
  const points = await lookupPostcodes(normalized.filter((p): p is string => !!p));

  const ids: number[] = [];
  const lats: (number | null)[] = [];
  const lngs: (number | null)[] = [];
  work.forEach((r, i) => {
    const key = normalized[i];
    const point = key ? points.get(key) ?? null : null;
    ids.push(r.id);
    lats.push(point?.lat ?? null);
    lngs.push(point?.lng ?? null);
  });

  await pool.query(
    `UPDATE employees e
        SET latitude = v.lat,
            longitude = v.lng,
            geocoded_postcode = UPPER(TRIM(e.postcode)),
            geocoded_at = NOW()
       FROM UNNEST($1::int[], $2::numeric[], $3::numeric[]) AS v(id, lat, lng)
      WHERE e.id = v.id AND e.tenant_id = $4`,
    [ids, lats, lngs, tenantId],
  );
  return { updated: work.length, remaining };
}
