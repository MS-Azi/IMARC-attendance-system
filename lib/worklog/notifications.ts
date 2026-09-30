import { prisma } from "@/lib/db";
import { RuleSetConfig, OffenceType } from "./config";
import { computeSlotWindows } from "./validate";
import { getRuleSetAt } from "./rules";
import { ensureSlotRecordsForDate, lagosTimeOnDay } from "./slots";
import { lagosDateKey, lagosMonthStr } from "./lagos";
import { OffenceEvent, categorizeOffences } from "./deductions";
import { sendPushToStaff } from "./push";
import { sendEmail } from "@/lib/mailer";

/** Records a send attempt; returns false (and does nothing else) if this exact
 * (staff, slot/entity, type) combination was already sent — the unique constraint on
 * dedupeKey is what actually enforces it, this just makes the check-then-send atomic
 * enough for a 5-minute cron that might occasionally overlap itself. */
async function logIfNew(dedupeKey: string, staffId: string, slotRecordId: string | null, type: string, channel: "PUSH" | "EMAIL") {
  try {
    await prisma.notificationLog.create({ data: { staffId, slotRecordId, type, channel, dedupeKey } });
    return true;
  } catch {
    return false; // unique constraint hit — already sent
  }
}

async function notify(staffId: string, title: string, body: string, url: string, emailFallback: { subject: string; to: string } | null) {
  const subs = await prisma.pushSubscription.count({ where: { staffId } });
  if (subs > 0) {
    await sendPushToStaff(staffId, { title, body, url }).catch(() => {});
    return "PUSH" as const;
  }
  // loginId is "phone or email" (Staff model) — only attempt email if it actually looks like one.
  if (emailFallback && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFallback.to)) {
    await sendEmail({ to: emailFallback.to, subject: emailFallback.subject, html: `<p>${body}</p>` }).catch(() => {});
    return "EMAIL" as const;
  }
  return "PUSH" as const; // nothing to send to, but still log so we don't retry forever
}

type ActiveStaff = { id: string; fullName: string; loginId: string; dateJoined: Date };

async function getActiveStaffWithEmail(): Promise<ActiveStaff[]> {
  return prisma.staff.findMany({ where: { active: true }, select: { id: true, fullName: true, loginId: true, dateJoined: true } });
}

/** Step 1+2+3 of the cron: ensure today's records exist, send due-soon/now-late
 * reminders once each, and mark MISSED any slot whose late window has closed.
 * `deadline` (ms epoch) is checked once per staff member so a slow run stops
 * starting new work instead of running past the cron's own time budget. */
export async function runSlotReminders(now: Date = new Date(), deadline: number = Date.now() + 20000) {
  const staffList = await getActiveStaffWithEmail();
  let dueSoonSent = 0,
    nowLateSent = 0,
    missedMarked = 0,
    truncated = false;

  for (const staff of staffList) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    const ensured = await ensureSlotRecordsForDate(staff.id, now, { allowFuture: false });
    if (!ensured) continue;
    const { config, dayKey } = ensured;

    const records = await prisma.slotRecord.findMany({ where: { staffId: staff.id, date: dayKey } });
    const windows = computeSlotWindows(config);

    for (const r of records) {
      const w = windows[r.slotIndex] ?? windows[windows.length - 1];
      // Due-soon fires `reminderMinsBefore` minutes before the slot's own time, not
      // before the window opens.
      const slotTimeMin = w.opens + w.slot.opensBeforeMins;
      const dueSoonInstant = lagosTimeOnDay(dayKey, slotTimeMin - config.reminderMinsBefore);
      const onTimeClosesAt = lagosTimeOnDay(dayKey, w.onTimeCloses);
      const lateClosesAt = lagosTimeOnDay(dayKey, w.lateCloses);

      if (r.outcome === "PENDING") {
        if (now >= dueSoonInstant && now < onTimeClosesAt) {
          const sent = await logIfNew(`${staff.id}:${r.id}:DUE_SOON`, staff.id, r.id, "DUE_SOON", "PUSH");
          if (sent) {
            const channel = await notify(
              staff.id,
              "Update due soon",
              `Your ${r.slotLabel} update is due soon.`,
              "/clock",
              { subject: "Update due soon", to: staff.loginId } // notify() only actually emails if there's no push subscription
            );
            await prisma.notificationLog.updateMany({ where: { dedupeKey: `${staff.id}:${r.id}:DUE_SOON` }, data: { channel } });
            dueSoonSent++;
          }
        }
        if (now >= onTimeClosesAt && now < lateClosesAt) {
          const sent = await logIfNew(`${staff.id}:${r.id}:NOW_LATE`, staff.id, r.id, "NOW_LATE", "PUSH");
          if (sent) {
            const channel = await notify(
              staff.id,
              "Update now late",
              `Your ${r.slotLabel} update is now late.`,
              "/clock",
              config.emailOnLate ? { subject: "Update now late", to: staff.loginId } : null
            );
            await prisma.notificationLog.updateMany({ where: { dedupeKey: `${staff.id}:${r.id}:NOW_LATE` }, data: { channel } });
            nowLateSent++;
          }
        }
        if (now >= lateClosesAt) {
          await prisma.slotRecord.update({ where: { id: r.id }, data: { outcome: "MISSED" } });
          missedMarked++;
        }
      }
    }
  }

  return { dueSoonSent, nowLateSent, missedMarked, truncated };
}

/** Step 4: evaluate this month's offences per active staff member and send a
 * "warning issued" notice the first time a fresh offence lands within the warning
 * allowance. Idempotent per (staff, entity, type) via NotificationLog. */
export async function runWarningNotices(now: Date = new Date(), deadline: number = Date.now() + 20000) {
  const staffList = await getActiveStaffWithEmail();
  const monthStr = lagosMonthStr(now);
  let sent = 0;
  let truncated = false;

  for (const staff of staffList) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    const [year, month] = monthStr.split("-").map(Number);
    const start = lagosDateKey(new Date(Date.UTC(year, month - 1, 1)));
    const end = lagosDateKey(new Date(Date.UTC(year, month, 1)));

    const slotRecords = await prisma.slotRecord.findMany({
      where: { staffId: staff.id, date: { gte: start, lt: end } },
      include: { ruleSet: true },
    });

    const events: (OffenceEvent & { entityId: string })[] = [];
    for (const r of slotRecords) {
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

    const lateAttendance = await prisma.attendance.findMany({
      where: { staffId: staff.id, date: { gte: start, lt: end }, status: "LATE" },
      include: { offenceReview: true },
    });
    for (const a of lateAttendance) {
      if (a.offenceReview) continue;
      const ruleSet = await getRuleSetAt(a.date);
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
      const logged = await logIfNew(dedupeKey, staff.id, null, "WARNING", "PUSH");
      if (!logged) continue;
      const channel = await notify(
        staff.id,
        "Warning issued",
        `Warning ${c.ordinal} of ${c.warningAllowance} for ${c.type.replace(/_/g, " ").toLowerCase()} this month. Further offences may attract deductions.`,
        "/worklog/me",
        { subject: "Warning issued", to: staff.loginId }
      );
      await prisma.notificationLog.updateMany({ where: { dedupeKey }, data: { channel } });
      sent++;
    }
  }

  return { sent, truncated };
}

/** Called when a new rule-set version is published — pushes (or emails) every active
 * staff member once. Not part of the cron; called directly from the rules API route. */
export async function notifyRulesChanged(effectiveFrom: Date) {
  const staffList = await getActiveStaffWithEmail();
  const dateStr = effectiveFrom.toISOString().slice(0, 10);
  let sent = 0;
  for (const staff of staffList) {
    const dedupeKey = `${staff.id}:rules-${effectiveFrom.getTime()}:RULES_CHANGED`;
    const logged = await logIfNew(dedupeKey, staff.id, null, "RULES_CHANGED", "PUSH");
    if (!logged) continue;
    const channel = await notify(
      staff.id,
      "Work update rules have changed",
      `Effective ${dateStr}. Open the app to review and acknowledge.`,
      "/worklog/rules",
      { subject: "Work update rules have changed", to: staff.loginId }
    );
    await prisma.notificationLog.updateMany({ where: { dedupeKey }, data: { channel } });
    sent++;
  }
  return { sent };
}
