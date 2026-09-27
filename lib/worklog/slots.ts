import { prisma } from "@/lib/db";
import { RuleSetConfig } from "./config";
import { computeSlotWindows } from "./validate";
import { lagosDateKey, lagosWeekday, lagosMonthStr } from "./lagos";
import { getRuleSetAt } from "./rules";

export type DisplayStatus =
  | "UPCOMING"
  | "OPEN_ON_TIME"
  | "OPEN_LATE"
  | "MISSED"
  | "ON_TIME"
  | "LATE"
  | "EXCUSED";

/** Converts a minute-of-day (Lagos) into the actual UTC instant on the given Lagos day. */
export function lagosTimeOnDay(dayKeyUTC: Date, minutesSinceMidnight: number): Date {
  return new Date(dayKeyUTC.getTime() + minutesSinceMidnight * 60000);
}

export async function isWorkingDay(config: Pick<RuleSetConfig, "workingWeekdays">, date: Date): Promise<boolean> {
  if (!config.workingWeekdays.includes(lagosWeekday(date))) return false;
  const dayKey = lagosDateKey(date);
  const nonWorking = await prisma.nonWorkingDay.findUnique({ where: { date: dayKey } });
  return !nonWorking;
}

/**
 * A slot's live status — never trusts a stale PENDING outcome once its window has
 * closed, so "missed" shows immediately rather than waiting for the next cron tick
 * (Phase 4) to formally write MISSED to the record. Takes `now` as an absolute
 * instant compared against the day's window instants (already Lagos-resolved).
 */
export function deriveDisplayStatusAt(
  record: { outcome: string; reviewStatus: string },
  windowInstants: { opensAt: Date; onTimeClosesAt: Date; lateClosesAt: Date },
  now: Date
): DisplayStatus {
  if (record.reviewStatus === "EXCUSED") return "EXCUSED";
  if (record.outcome === "ON_TIME") return "ON_TIME";
  if (record.outcome === "LATE") return "LATE";

  if (now < windowInstants.opensAt) return "UPCOMING";
  if (now < windowInstants.onTimeClosesAt) return "OPEN_ON_TIME";
  if (now < windowInstants.lateClosesAt) return "OPEN_LATE";
  return "MISSED";
}

/** Ensures a given Lagos day's SlotRecord rows exist for a staff member — created
 * lazily (here, and by the admin review board / bulk-excuse) rather than only by
 * the (Phase 4) cron, per spec 6.3. Uses whichever rule set was in force ON that
 * date, so this is equally correct for past, present, or future dates. */
export async function ensureSlotRecordsForDate(staffId: string, date: Date) {
  const ruleSet = await getRuleSetAt(date);
  if (!ruleSet) return null;

  const config = ruleSet.config as unknown as RuleSetConfig;
  if (!(await isWorkingDay(config, date))) return null;

  const dayKey = lagosDateKey(date);
  const windows = computeSlotWindows(config);

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    await prisma.slotRecord.upsert({
      where: { staffId_date_slotIndex: { staffId, date: dayKey, slotIndex: i } },
      update: {},
      create: {
        staffId,
        date: dayKey,
        slotIndex: i,
        slotLabel: w.slot.label,
        slotTime: w.slot.time,
        ruleSetId: ruleSet.id,
      },
    });
  }

  return { ruleSet, config, dayKey, windows };
}

/** Today's (Lagos) SlotRecord rows for a staff member. */
export function ensureTodaySlotRecords(staffId: string, now: Date = new Date()) {
  return ensureSlotRecordsForDate(staffId, now);
}

export type TodaySlotView = {
  id: string;
  slotIndex: number;
  label: string;
  opensAt: string;
  onTimeClosesAt: string;
  lateClosesAt: string;
  status: DisplayStatus;
  note: string | null;
  link: string | null;
  tickedAt: string | null;
};

export async function getTodaySlotsForStaff(staffId: string, now: Date = new Date()): Promise<TodaySlotView[] | null> {
  const ensured = await ensureTodaySlotRecords(staffId, now);
  if (!ensured) return null;
  const { dayKey } = ensured;

  // Each record uses its OWN stored ruleSetId to compute its window, not whatever
  // rule set is current right now — if rules changed mid-day (an "apply immediately"
  // override), a record created under the earlier version must keep using it.
  const records = await prisma.slotRecord.findMany({
    where: { staffId, date: dayKey },
    include: { ruleSet: true },
    orderBy: { slotIndex: "asc" },
  });

  return records.map((r) => {
    const config = r.ruleSet.config as unknown as RuleSetConfig;
    const windows = computeSlotWindows(config);
    const w = windows[r.slotIndex] ?? windows[windows.length - 1];
    const opensAt = lagosTimeOnDay(dayKey, w.opens);
    const onTimeClosesAt = lagosTimeOnDay(dayKey, w.onTimeCloses);
    const lateClosesAt = lagosTimeOnDay(dayKey, w.lateCloses);
    return {
      id: r.id,
      slotIndex: r.slotIndex,
      label: r.slotLabel,
      opensAt: opensAt.toISOString(),
      onTimeClosesAt: onTimeClosesAt.toISOString(),
      lateClosesAt: lateClosesAt.toISOString(),
      status: deriveDisplayStatusAt(r, { opensAt, onTimeClosesAt, lateClosesAt }, now),
      note: r.note,
      link: r.link,
      tickedAt: r.tickedAt?.toISOString() ?? null,
    };
  });
}

export type MonthOffenceCounts = Record<"LATE_SUBMISSION" | "MISSED_SUBMISSION" | "FALSE_SUBMISSION", number>;

export async function getMonthRecordsForStaff(staffId: string, monthStr: string, now: Date = new Date()) {
  const [year, month] = monthStr.split("-").map(Number);
  const start = lagosDateKey(new Date(Date.UTC(year, month - 1, 1)));
  const end = lagosDateKey(new Date(Date.UTC(year, month, 1)));

  const records = await prisma.slotRecord.findMany({
    where: { staffId, date: { gte: start, lt: end } },
    include: { ruleSet: true },
    orderBy: [{ date: "asc" }, { slotIndex: "asc" }],
  });

  const counts: MonthOffenceCounts = { LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 };
  const byDay: Record<string, { date: string; slots: TodaySlotView[] }> = {};

  for (const r of records) {
    const config = r.ruleSet.config as unknown as RuleSetConfig;
    const windows = computeSlotWindows(config);
    const w = windows[r.slotIndex] ?? windows[windows.length - 1];
    const opensAt = lagosTimeOnDay(r.date, w.opens);
    const onTimeClosesAt = lagosTimeOnDay(r.date, w.onTimeCloses);
    const lateClosesAt = lagosTimeOnDay(r.date, w.lateCloses);
    const status = deriveDisplayStatusAt(r, { opensAt, onTimeClosesAt, lateClosesAt }, now);

    if (r.reviewStatus === "FALSE") counts.FALSE_SUBMISSION++;
    else if (status === "MISSED") counts.MISSED_SUBMISSION++;
    else if (status === "LATE") counts.LATE_SUBMISSION++;

    const dayKeyStr = r.date.toISOString();
    if (!byDay[dayKeyStr]) byDay[dayKeyStr] = { date: dayKeyStr, slots: [] };
    byDay[dayKeyStr].slots.push({
      id: r.id,
      slotIndex: r.slotIndex,
      label: r.slotLabel,
      opensAt: opensAt.toISOString(),
      onTimeClosesAt: onTimeClosesAt.toISOString(),
      lateClosesAt: lateClosesAt.toISOString(),
      status,
      note: r.note,
      link: r.link,
      tickedAt: r.tickedAt?.toISOString() ?? null,
    });
  }

  return { days: Object.values(byDay), counts, monthStr: monthStr || lagosMonthStr(now) };
}
