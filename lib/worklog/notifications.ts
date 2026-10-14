import { prisma } from "@/lib/db";
import { RuleSetConfig, OffenceType } from "./config";
import { computeSlotWindows } from "./validate";
import { getRuleSetAt } from "./rules";
import { lagosTimeOnDay } from "./slots";
import { lagosDateKey, lagosMonthStr, lagosWeekday } from "./lagos";
import { checkSlotCreationGuards } from "./guards";
import { OffenceEvent, categorizeOffences } from "./deductions";
import { sendPushToStaff } from "./push";

/** Records a send attempt; returns false (and does nothing else) if this exact
 * (staff, slot/entity, type) combination was already sent — the unique constraint on
 * dedupeKey is what actually enforces it, this just makes the check-then-send atomic
 * enough for a 5-minute cron that might occasionally overlap itself. */
async function logIfNew(dedupeKey: string, staffId: string, slotRecordId: string | null, type: string) {
  try {
    await prisma.notificationLog.create({ data: { staffId, slotRecordId, type, channel: "PUSH", dedupeKey } });
    return true;
  } catch {
    return false; // unique constraint hit — already sent
  }
}

/** Push only — no email fallback. A staff member with no push subscription simply
 * doesn't get this notification; it's still logged so the cron doesn't retry forever. */
async function notify(staffId: string, title: string, body: string, url: string) {
  await sendPushToStaff(staffId, { title, body, url }).catch(() => {});
}

type ActiveStaff = { id: string; fullName: string; loginId: string; dateJoined: Date };

async function getActiveStaff(): Promise<ActiveStaff[]> {
  return prisma.staff.findMany({ where: { active: true }, select: { id: true, fullName: true, loginId: true, dateJoined: true } });
}

/** Rotates the (id-sorted) staff list by one position every 5-minute cron slot, so
 * no one is permanently last if a run is ever cut short by the deadline. */
function rotate<T extends { id: string }>(list: T[], now: Date): T[] {
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  if (!sorted.length) return sorted;
  const offset = Math.floor(now.getTime() / 300000) % sorted.length;
  return [...sorted.slice(offset), ...sorted.slice(0, offset)];
}

/** Every non-superseded rule set, newest first — resolve per day in memory with
 * ruleSetFor(), which picks exactly what getRuleSetAt() would. */
async function loadRuleSets() {
  return prisma.worklogRuleSet.findMany({
    where: { supersededAt: null },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
}
function ruleSetFor<T extends { effectiveFrom: Date }>(ruleSets: T[], date: Date): T | undefined {
  const dayKey = lagosDateKey(date);
  return ruleSets.find((r) => r.effectiveFrom.getTime() <= dayKey.getTime());
}

/** Step 1+2+3 of the cron: ensure today's records exist, send due-soon/now-late
 * reminders once each, and mark MISSED any PENDING slot (today or an earlier day)
 * whose late window has closed — judged by the rule set the slot was created under.
 * Batched (a fixed handful of queries for everyone, not a chain per staff member) so
 * a full run fits well inside the cron budget. Only existing rows are ever marked;
 * rows are created for today only, never for past days. `deadline` (ms epoch) is
 * still checked per staff member before sending their reminders. */
export async function runSlotReminders(now: Date = new Date(), deadline: number = Date.now() + 20000) {
  const staffList = rotate(await getActiveStaff(), now);
  const today = lagosDateKey(now);
  let dueSoonSent = 0,
    nowLateSent = 0,
    missedMarked = 0,
    truncated = false;
  const processed: string[] = [];

  const [ruleSet, settings, nonWorking] = await Promise.all([
    getRuleSetAt(now),
    prisma.worklogSettings.findUnique({ where: { id: 1 } }),
    prisma.nonWorkingDay.findUnique({ where: { date: today } }),
  ]);

  // 1. Today's rows for every eligible staff member, in one insert (same guards and
  //    same row contents as ensureSlotRecordsForDate; existing rows are left alone).
  if (ruleSet) {
    const config = ruleSet.config as unknown as RuleSetConfig;
    const windows = computeSlotWindows(config);
    const eligible = staffList.filter(
      (s) =>
        checkSlotCreationGuards({
          date: today,
          today,
          weekday: lagosWeekday(now),
          workingWeekdays: config.workingWeekdays,
          isNonWorkingDay: !!nonWorking,
          worklogStartDate: settings?.startDate ?? null,
          staffDateJoined: lagosDateKey(s.dateJoined),
          allowFuture: false,
        }).allowed
    );
    if (eligible.length) {
      await prisma.slotRecord.createMany({
        data: eligible.flatMap((s) =>
          windows.map((w, i) => ({ staffId: s.id, date: today, slotIndex: i, slotLabel: w.slot.label, slotTime: w.slot.time, ruleSetId: ruleSet.id }))
        ),
        skipDuplicates: true,
      });
    }
  }

  // 2. Every still-PENDING slot up to today, each with its own rule set.
  const pending = await prisma.slotRecord.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, outcome: "PENDING", date: { lte: today } },
    include: { ruleSet: true },
  });

  const toMarkMissed: string[] = [];
  for (const staff of staffList) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    processed.push(staff.fullName);
    for (const r of pending.filter((x) => x.staffId === staff.id)) {
      const config = r.ruleSet.config as unknown as RuleSetConfig;
      const windows = computeSlotWindows(config);
      const w = windows[r.slotIndex] ?? windows[windows.length - 1];
      // Due-soon fires `reminderMinsBefore` minutes before the slot's own time, not
      // before the window opens.
      const slotTimeMin = w.opens + w.slot.opensBeforeMins;
      const dueSoonInstant = lagosTimeOnDay(r.date, slotTimeMin - config.reminderMinsBefore);
      const onTimeClosesAt = lagosTimeOnDay(r.date, w.onTimeCloses);
      const lateClosesAt = lagosTimeOnDay(r.date, w.lateCloses);

      if (now >= dueSoonInstant && now < onTimeClosesAt) {
        const sent = await logIfNew(`${staff.id}:${r.id}:DUE_SOON`, staff.id, r.id, "DUE_SOON");
        if (sent) {
          await notify(staff.id, "Update due soon", `Your ${r.slotLabel} update is due soon.`, "/clock");
          dueSoonSent++;
        }
      }
      if (now >= onTimeClosesAt && now < lateClosesAt) {
        const sent = await logIfNew(`${staff.id}:${r.id}:NOW_LATE`, staff.id, r.id, "NOW_LATE");
        if (sent) {
          await notify(staff.id, "Update now late", `Your ${r.slotLabel} update is now late.`, "/clock");
          nowLateSent++;
        }
      }
      if (now >= lateClosesAt) toMarkMissed.push(r.id);
    }
  }

  // 3. One update for all expired slots. The outcome check means a submission that
  //    landed since step 2 is never overwritten.
  if (toMarkMissed.length) {
    const res = await prisma.slotRecord.updateMany({ where: { id: { in: toMarkMissed }, outcome: "PENDING" }, data: { outcome: "MISSED" } });
    missedMarked = res.count;
  }

  return { dueSoonSent, nowLateSent, missedMarked, truncated, processed, staffTotal: staffList.length };
}

/** Step 4: evaluate this month's offences per active staff member and send a
 * "warning issued" notice the first time a fresh offence lands within the warning
 * allowance. Idempotent per (staff, entity, type) via NotificationLog. Data for all
 * staff is loaded up front in three queries; offences are evaluated exactly as before. */
export async function runWarningNotices(now: Date = new Date(), deadline: number = Date.now() + 20000) {
  const staffList = rotate(await getActiveStaff(), now);
  const monthStr = lagosMonthStr(now);
  let sent = 0;
  let truncated = false;
  const processed: string[] = [];

  const [year, month] = monthStr.split("-").map(Number);
  const start = lagosDateKey(new Date(Date.UTC(year, month - 1, 1)));
  const end = lagosDateKey(new Date(Date.UTC(year, month, 1)));
  const staffIds = staffList.map((s) => s.id);

  const [allSlotRecords, allLateAttendance, ruleSets] = await Promise.all([
    prisma.slotRecord.findMany({ where: { staffId: { in: staffIds }, date: { gte: start, lt: end } }, include: { ruleSet: true } }),
    prisma.attendance.findMany({
      where: { staffId: { in: staffIds }, date: { gte: start, lt: end }, status: "LATE" },
      include: { offenceReview: true },
    }),
    loadRuleSets(),
  ]);

  for (const staff of staffList) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    processed.push(staff.fullName);

    const events: (OffenceEvent & { entityId: string })[] = [];
    for (const r of allSlotRecords.filter((x) => x.staffId === staff.id)) {
      const config = r.ruleSet.config as unknown as RuleSetConfig;
      let type: OffenceType | null = null;
      if (r.reviewStatus === "FALSE") type = "FALSE_SUBMISSION";
      else if (r.reviewStatus === "VALID" && r.outcome === "MISSED") type = "MISSED_SUBMISSION";
      else if (r.reviewStatus === "VALID" && r.outcome === "LATE") type = "LATE_SUBMISSION";
      if (!type) continue;
      events.push({
        type,
        ruleSetId: r.ruleSetId,
        warningAllowance: config.warningAllowance[type],
        occurredAt: r.tickedAt ?? r.updatedAt,
        entityId: r.id,
      });
    }

    for (const a of allLateAttendance.filter((x) => x.staffId === staff.id)) {
      if (a.offenceReview) continue;
      const ruleSet = ruleSetFor(ruleSets, a.date);
      if (!ruleSet) continue;
      const config = ruleSet.config as unknown as RuleSetConfig;
      events.push({
        type: "LATE_CLOCK_IN",
        ruleSetId: ruleSet.id,
        warningAllowance: config.warningAllowance.LATE_CLOCK_IN,
        occurredAt: a.clockIn ?? a.date,
        entityId: a.id,
      });
    }

    const categorized = categorizeOffences(events);
    for (const c of categorized) {
      if (!c.isWarning) continue;
      const dedupeKey = `${staff.id}:${c.entityId}:WARNING`;
      const logged = await logIfNew(dedupeKey, staff.id, null, "WARNING");
      if (!logged) continue;
      await notify(
        staff.id,
        "Warning issued",
        `Warning ${c.ordinal} of ${c.warningAllowance} for ${c.type.replace(/_/g, " ").toLowerCase()} this month. Further offences may attract deductions.`,
        "/worklog/me"
      );
      sent++;
    }
  }

  return { sent, truncated, processed };
}

/** Called when a new rule-set version is published — pushes every active staff
 * member once. Not part of the cron; called directly from the rules API route. */
export async function notifyRulesChanged(effectiveFrom: Date) {
  const staffList = await getActiveStaff();
  const dateStr = effectiveFrom.toISOString().slice(0, 10);
  let sent = 0;
  for (const staff of staffList) {
    const dedupeKey = `${staff.id}:rules-${effectiveFrom.getTime()}:RULES_CHANGED`;
    const logged = await logIfNew(dedupeKey, staff.id, null, "RULES_CHANGED");
    if (!logged) continue;
    await notify(staff.id, "Work update rules have changed", `Effective ${dateStr}. Open the app to review and acknowledge.`, "/worklog/rules");
    sent++;
  }
  return { sent };
}
