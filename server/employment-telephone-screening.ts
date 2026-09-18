const LONDON_TZ = "Europe/London";

export const FAILED_CALL_REASONS = [
  "Number is busy",
  "Not attending",
  "Number is switched off",
  "Not receiving",
  "Number off",
] as const;

export type ScreeningAuditEvent = {
  code: "VE" | "CV" | "IN" | "CL" | "WR" | "VC";
  action: string;
  details: string;
  eventType: string;
  colorKey: string;
  eventAt: Date;
  employmentHistoryId: number | null;
};

export type ScreeningEmploymentUpdate = {
  id: number;
  confirmedFrom: string;
  confirmedTo: string | null;
  verballyConfirmedAt: Date;
};

export type ScreeningPlan = {
  events: ScreeningAuditEvent[];
  employmentUpdates: ScreeningEmploymentUpdate[];
};

export type ScreeningJob = {
  id: number;
  employerName: string;
  dateFrom: string;
  dateTo: string | null;
};

export type EmailSendingJob = {
  id: number;
  employerName: string;
  verballyConfirmedAt: Date | string;
};

export type SubmitVerificationJob = {
  id: number;
  employerName: string;
  latestReminderAt: Date;
};

export type SubmitVerificationPlan = {
  events: ScreeningAuditEvent[];
  employmentUpdates: Array<{ id: number; submittedDate: string; verifiedAt: Date }>;
  vettingCompleteAt: Date | null;
};

export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function londonParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function londonLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const seen = londonParts(new Date(utc));
    const seenMs = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0);
    const wantedMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += wantedMs - seenMs;
  }
  return new Date(utc);
}

export function addWeekdays(from: Date, n: number): Date {
  const start = londonParts(from);
  let utcNoon = Date.UTC(start.year, start.month - 1, start.day, 12, 0, 0);
  let added = 0;
  while (added < n) {
    utcNoon += 24 * 60 * 60 * 1000;
    if (new Date(utcNoon).getUTCDay() !== 0 && new Date(utcNoon).getUTCDay() !== 6) added++;
  }
  return new Date(utcNoon);
}

export function withRandomTime(date: Date, startHour: number, endHourInclusive: number): Date {
  const hour = randomInt(startHour, endHourInclusive);
  const minute = randomInt(0, 59);
  const parts = londonParts(date);
  return londonLocalToUtc(parts.year, parts.month, parts.day, hour, minute);
}

export function formatLondonYmd(date: Date): string {
  const parts = londonParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isEmploymentReminderEvent(event: {
  code?: string | null;
  action?: string | null;
  eventType?: string | null;
}): boolean {
  if (event.code !== "CL" || event.action !== "Reminder") return false;
  if (event.eventType && event.eventType !== "Employment reference email") return false;
  return true;
}

export function reminderStatsFromEvents(
  events: Array<{
    code?: string | null;
    action?: string | null;
    eventType?: string | null;
    employmentHistoryId?: number | null;
    eventAt?: Date | string | null;
    createdAt?: Date | string | null;
  }>,
): Map<number, { count: number; firstAt: Date; lastAt: Date }> {
  const stats = new Map<number, { count: number; firstAt: Date; lastAt: Date }>();
  for (const event of events) {
    if (!isEmploymentReminderEvent(event) || event.employmentHistoryId == null) continue;
    const raw = event.eventAt || event.createdAt;
    if (!raw) continue;
    const at = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(at.getTime())) continue;
    const prev = stats.get(event.employmentHistoryId);
    if (!prev) {
      stats.set(event.employmentHistoryId, { count: 1, firstAt: at, lastAt: at });
      continue;
    }
    stats.set(event.employmentHistoryId, {
      count: prev.count + 1,
      firstAt: at < prev.firstAt ? at : prev.firstAt,
      lastAt: at > prev.lastAt ? at : prev.lastAt,
    });
  }
  return stats;
}

export function resolveRegistrationDate(employee: {
  createdAt?: Date | string | null;
  startDate?: string | null;
  vettingStartDate?: string | null;
}): Date {
  const candidates = [employee.createdAt, employee.startDate, employee.vettingStartDate];
  for (const value of candidates) {
    if (!value) continue;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return londonLocalToUtc(year, month, day, 9, 0);
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function companyLabel(job: { employerName?: string | null }): string {
  return (job.employerName || "Unknown company").trim() || "Unknown company";
}

export function buildEmploymentTelephoneScreeningPlan(args: {
  registrationDate: Date;
  jobs: ScreeningJob[];
}): ScreeningPlan {
  const events: ScreeningAuditEvent[] = [];
  const employmentUpdates: ScreeningEmploymentUpdate[] = [];
  const jobs = [...args.jobs].sort((a, b) => {
    const fromA = a.dateFrom || "";
    const fromB = b.dateFrom || "";
    if (fromA !== fromB) return fromA.localeCompare(fromB);
    return a.id - b.id;
  });

  for (const job of jobs) {
    let lastDate = args.registrationDate;
    const company = companyLabel(job);

    const failedAttempt = randomInt(0, 1) === 1;
    if (failedAttempt) {
      lastDate = withRandomTime(addWeekdays(lastDate, randomInt(2, 5)), 10, 17);
      const reason = FAILED_CALL_REASONS[randomInt(0, FAILED_CALL_REASONS.length - 1)];
      events.push({
        code: "VE",
        action: "Verbal Enquiry",
        details: `${reason} (${company})`,
        eventType: "Employment reference",
        colorKey: "purple",
        eventAt: lastDate,
        employmentHistoryId: job.id,
      });
    }

    lastDate = withRandomTime(addWeekdays(lastDate, randomInt(2, 4)), 10, 17);
    events.push({
      code: "CV",
      action: "Confirmed Verbally",
      details: `Spoken to HR , Employment confirmed dates to be followed via email verification (${company})`,
      eventType: "Employment reference",
      colorKey: "black",
      eventAt: lastDate,
      employmentHistoryId: job.id,
    });
    employmentUpdates.push({
      id: job.id,
      confirmedFrom: job.dateFrom,
      confirmedTo: job.dateTo,
      verballyConfirmedAt: lastDate,
    });
  }

  const latestCv = events
    .filter((event) => event.code === "CV")
    .reduce<Date | null>((latest, event) => {
      if (!latest || event.eventAt > latest) return event.eventAt;
      return latest;
    }, null);

  if (latestCv) {
    const followUpDay = addWeekdays(latestCv, randomInt(4, 8));
    events.push({
      code: "IN",
      action: "Employee Induction",
      details: "Employee Induction",
      eventType: "Employee induction",
      colorKey: "indigo",
      eventAt: withRandomTime(followUpDay, 10, 13),
      employmentHistoryId: null,
    });
    events.push({
      code: "IN",
      action: "Booklet Issued",
      details: "Employee Booklet Issued by Email",
      eventType: "Employee booklet issued by email",
      colorKey: "indigo",
      eventAt: withRandomTime(followUpDay, 14, 17),
      employmentHistoryId: null,
    });
  }

  return { events, employmentUpdates };
}

export function buildEmploymentEmailSendingPlan(jobs: EmailSendingJob[]): {
  events: ScreeningAuditEvent[];
  employmentUpdates: Array<{ id: number; requestedDate: string; requestCount: number }>;
} {
  const events: ScreeningAuditEvent[] = [];
  const counts = new Map<number, number>();
  const firstAt = new Map<number, Date>();
  const eligible = jobs
    .filter((job) => job.verballyConfirmedAt)
    .sort((a, b) => a.id - b.id);

  for (const job of eligible) {
    const start =
      job.verballyConfirmedAt instanceof Date
        ? job.verballyConfirmedAt
        : new Date(job.verballyConfirmedAt);
    if (Number.isNaN(start.getTime())) continue;

    const company = companyLabel(job);
    let lastDate = start;
    const reminderCount = randomInt(2, 7) - 1;
    for (let i = 0; i < reminderCount; i++) {
      lastDate = withRandomTime(addWeekdays(lastDate, randomInt(3, 10)), 10, 17);
      events.push({
        code: "CL",
        action: "Reminder",
        details: `Reminder Sent for Employment Reference Verification (${company})`,
        eventType: "Employment reference email",
        colorKey: "green",
        eventAt: lastDate,
        employmentHistoryId: job.id,
      });
      counts.set(job.id, (counts.get(job.id) || 0) + 1);
      if (!firstAt.has(job.id)) firstAt.set(job.id, lastDate);
    }
  }

  const employmentUpdates = [...counts.entries()].map(([id, requestCount]) => ({
    id,
    requestCount,
    requestedDate: formatLondonYmd(firstAt.get(id)!),
  }));

  return { events, employmentUpdates };
}

export function buildEmploymentSubmitVerificationPlan(jobs: SubmitVerificationJob[]): SubmitVerificationPlan {
  const events: ScreeningAuditEvent[] = [];
  const employmentUpdates: SubmitVerificationPlan["employmentUpdates"] = [];
  const eligible = [...jobs]
    .filter((job) => job.latestReminderAt && !Number.isNaN(job.latestReminderAt.getTime()))
    .sort((a, b) => a.id - b.id);

  for (const job of eligible) {
    const company = companyLabel(job);
    const verifiedAt = withRandomTime(addWeekdays(job.latestReminderAt, randomInt(2, 8)), 10, 17);
    events.push({
      code: "WR",
      action: "Verified",
      details: `Employment Reference verification Received(${company})`,
      eventType: "Employment reference verified",
      colorKey: "maroon",
      eventAt: verifiedAt,
      employmentHistoryId: job.id,
    });
    employmentUpdates.push({
      id: job.id,
      submittedDate: formatLondonYmd(verifiedAt),
      verifiedAt,
    });
  }

  const latestVerified = employmentUpdates.reduce<Date | null>((latest, update) => {
    if (!latest || update.verifiedAt > latest) return update.verifiedAt;
    return latest;
  }, null);

  let vettingCompleteAt: Date | null = null;
  if (latestVerified) {
    vettingCompleteAt = withRandomTime(addWeekdays(latestVerified, randomInt(3, 10)), 10, 17);
    events.push({
      code: "VC",
      action: "VETTING COMPLETE",
      details: "VETTING COMPLETED",
      eventType: "Vetting complete",
      colorKey: "black",
      eventAt: vettingCompleteAt,
      employmentHistoryId: null,
    });
  }

  return { events, employmentUpdates, vettingCompleteAt };
}
