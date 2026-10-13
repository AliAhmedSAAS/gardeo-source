/** Grace period before late minutes / pay deduction start counting. */
export const LATE_GRACE_MINUTES = 15;

export type LateDeductionResult = {
  /** Minutes after scheduled start before grace is applied. */
  rawLateMinutes: number;
  /** Chargeable late minutes after the grace period (0 within grace). */
  lateMinutes: number;
  /**
   * Positive hours stored on shifts.late_hours.
   * Payroll / PANL subtract these from paid hours (duty + holiday − late).
   */
  lateHours: string;
};

/**
 * Late deduction from book-on / check-in time vs scheduled shift start.
 * First {@link LATE_GRACE_MINUTES} minutes are free; after that late = raw − grace.
 */
export function calculateLateDeduction(
  scheduledStart: Date | null | undefined,
  bookOnAt: Date | null | undefined,
  graceMinutes: number = LATE_GRACE_MINUTES,
): LateDeductionResult {
  if (!scheduledStart || !bookOnAt || Number.isNaN(scheduledStart.getTime()) || Number.isNaN(bookOnAt.getTime())) {
    return { rawLateMinutes: 0, lateMinutes: 0, lateHours: "0.00" };
  }
  const grace = Math.max(0, Number(graceMinutes) || 0);
  const rawMs = bookOnAt.getTime() - scheduledStart.getTime();
  if (rawMs <= 0) {
    return { rawLateMinutes: 0, lateMinutes: 0, lateHours: "0.00" };
  }
  const rawLateMinutes = Math.ceil(rawMs / 60000);
  const lateMinutes = rawLateMinutes <= grace ? 0 : rawLateMinutes - grace;
  const hoursAbs = Math.round((lateMinutes / 60) * 100) / 100;
  const lateHours = hoursAbs === 0 ? "0.00" : hoursAbs.toFixed(2);
  return { rawLateMinutes, lateMinutes, lateHours };
}

/**
 * Build a Date for a shift date + HH:MM (or HH:MM:SS) start/book-on time.
 * Uses local time components so overnight handling stays with the caller.
 */
export function shiftDateTime(dateStr: string | Date | null | undefined, timeStr: string | null | undefined): Date | null {
  if (!dateStr || !timeStr) return null;
  const day = String(dateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  let t = String(timeStr).trim();
  if (t.length >= 19 && t.includes(" ")) t = t.slice(11, 16);
  else if (t.length >= 16 && t.includes("T")) t = t.slice(11, 16);
  else if (t.length > 5) t = t.slice(0, 5);
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  const d = new Date(`${day}T${hh}:${mm}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
