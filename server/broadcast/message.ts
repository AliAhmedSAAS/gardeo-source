import { pool } from "../db";

export type MessageScope = "single" | "all";

export type BroadcastSite = {
  id: number;
  name: string;
  address: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
};

type ShiftRow = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  pay_rate: string | null;
  title: string | null;
};

const MAX_LISTED_SHIFTS = 50;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const day = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function formatShiftLine(s: ShiftRow): string {
  const rate = s.pay_rate != null && Number(s.pay_rate) > 0 ? ` - £${Number(s.pay_rate).toFixed(2)}/hr` : "";
  return `${formatDate(s.date)}, ${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}${rate}`;
}

export async function loadSite(tenantId: number, siteId: number): Promise<BroadcastSite | null> {
  const { rows } = await pool.query(
    `SELECT id, name, address, postcode, latitude, longitude
       FROM sites WHERE id = $1 AND tenant_id = $2`,
    [siteId, tenantId],
  );
  return rows[0] ?? null;
}

export async function searchSites(tenantId: number, q: string): Promise<BroadcastSite[]> {
  const term = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { rows } = await pool.query(
    `SELECT id, name, address, postcode, latitude, longitude
       FROM sites
      WHERE tenant_id = $1
        AND COALESCE(is_active, true) = true
        AND (name ILIKE $2 OR address ILIKE $2 OR COALESCE(postcode, '') ILIKE $2 OR COALESCE(site_code, '') ILIKE $2)
      ORDER BY name
      LIMIT 20`,
    [tenantId, term],
  );
  return rows;
}

/**
 * Builds the default broadcast text for a shift. "all" lists every unfilled
 * upcoming shift at the same site alongside the selected one.
 */
export async function buildShiftMessage(tenantId: number, shiftId: number, scope: MessageScope): Promise<{
  site: BroadcastSite;
  shiftIds: number[];
  subject: string;
  body: string;
} | null> {
  const { rows: base } = await pool.query(
    `SELECT sh.id, sh.date::text AS date, sh.start_time, sh.end_time, sh.pay_rate::text AS pay_rate, sh.title, sh.site_id
       FROM shifts sh
      WHERE sh.id = $1 AND sh.tenant_id = $2`,
    [shiftId, tenantId],
  );
  const shift = base[0];
  if (!shift?.site_id) return null;

  const site = await loadSite(tenantId, shift.site_id);
  if (!site) return null;

  let shifts: ShiftRow[] = [shift];
  if (scope === "all") {
    const { rows } = await pool.query<ShiftRow>(
      `SELECT sh.id, sh.date::text AS date, sh.start_time, sh.end_time, sh.pay_rate::text AS pay_rate, sh.title
         FROM shifts sh
        WHERE sh.tenant_id = $1
          AND sh.site_id = $2
          AND sh.id <> $3
          AND sh.status = 'scheduled'
          AND sh.employee_id IS NULL
          AND sh.date >= CURRENT_DATE
        ORDER BY sh.date, sh.start_time
        LIMIT ${MAX_LISTED_SHIFTS - 1}`,
      [tenantId, site.id, shift.id],
    );
    shifts = [shift, ...rows].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
  }

  const { rows: tenantRows } = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(trading_name), ''), name) AS name, phone FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const tenant = tenantRows[0] ?? { name: "", phone: null };

  const location = [site.address, site.postcode].filter(Boolean).join(", ");
  const heading = shifts.length > 1 ? `${shifts.length} shifts available at ${site.name}` : `Shift available at ${site.name}`;
  const lines = [
    heading,
    location && location !== site.name ? `Location: ${location}` : "",
    "",
    ...shifts.map(formatShiftLine),
    "",
    tenant.phone
      ? `If you are available, reply to this message or call ${tenant.phone}.`
      : "If you are available, please reply to this message.",
    tenant.name || "",
  ];

  return {
    site,
    shiftIds: shifts.map((s) => s.id),
    subject: heading,
    body: lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").trim(),
  };
}
