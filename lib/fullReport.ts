import { prisma } from "./db";
import { MonthlySummary } from "./report";
import { isWorklogEnabled } from "./worklog/flags";
import { lagosMidnightUTC, lagosWeekday, lagosDateStr } from "./worklog/lagos";
import { getRuleSetAt } from "./worklog/rules";
import { RuleSetConfig } from "./worklog/config";
import { categorizeOffences } from "./worklog/deductions";
import { calculatePayroll, PayrollBreakdown } from "./worklog/payroll";
import { getPayrollOffenceEvents } from "./worklog/payrollCompute";

/**
 * Data for the on-demand Word + Excel monthly report. Strictly read-only: plain
 * findMany/findFirst reads plus the pure payroll engine — never ensureSlotRecordsForDate
 * or anything else that creates rows.
 */

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type SlotCounts = {
  total: number; // all slot rows except still-PENDING ones
  onTime: number;
  late: number;
  missed: number;
  falseCount: number;
  excused: number;
  pending: number; // window not yet marked by the cron — excluded from total
  compliancePct: number | null; // onTime / (total - excused)
};

export type StaffWorklog = {
  staffId: string;
  name: string;
  department: string | null;
  counts: SlotCounts;
  mostMissedSlot: string | null;
  mostMissedWeekday: string | null;
  lateClockIns: number; // unexcused, as counted by payroll
  warnings: number; // offences absorbed by the warning allowance
  offences: number;
  /** null = no salary on file, so no amount can be computed. */
  deduction: { breakdown: PayrollBreakdown; source: "finalized" | "provisional" } | null;
  flags: string[];
};

export type WorkUpdateRow = {
  date: Date;
  staff: string;
  slot: string;
  slotTime: string;
  outcome: string;
  tickedAt: Date | null;
  note: string | null;
  link: string | null;
  reviewStatus: string;
  reviewReason: string | null;
};

export type MonthWorklog = {
  monthStr: string;
  deductionsEnabled: boolean;
  capPercent: number;
  staff: StaffWorklog[];
  totals: SlotCounts;
  mostMissedSlot: string | null;
  mostMissedWeekday: string | null;
  rows: WorkUpdateRow[];
};

/** Same shape as the stored monthly summary, but attendance % only counts days each
 * person was actually expected in (see buildReportAttendance). */
export type ReportAttendance = Omit<MonthlySummary, "perStaff" | "overallAttendancePct"> & {
  overallAttendancePct: number | null;
  perStaff: (Omit<MonthlySummary["perStaff"][number], "attendancePct"> & { expectedDays: number; attendancePct: number | null })[];
};

export type FullReport = {
  monthStr: string;
  monthLabel: string;
  generatedAt: Date;
  attendance: ReportAttendance;
  worklog: MonthWorklog | null; // null when the worklog module is off
  previous: MonthWorklog | null;
  summary: string[];
};

const NEAR_CAP_RATIO = 0.8;

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function prevMonthStr(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function emptyCounts(): SlotCounts {
  return { total: 0, onTime: 0, late: 0, missed: 0, falseCount: 0, excused: 0, pending: 0, compliancePct: null };
}

/** Review status wins over outcome: a ticked slot reviewed FALSE counts as false, not on time. */
function classify(r: { outcome: string; reviewStatus: string }): keyof Omit<SlotCounts, "total" | "compliancePct"> {
  if (r.reviewStatus === "FALSE") return "falseCount";
  if (r.reviewStatus === "EXCUSED") return "excused";
  if (r.outcome === "ON_TIME") return "onTime";
  if (r.outcome === "LATE") return "late";
  if (r.outcome === "MISSED") return "missed";
  return "pending";
}

function finishCounts(c: SlotCounts) {
  c.total = c.onTime + c.late + c.missed + c.falseCount + c.excused;
  const counted = c.total - c.excused; // excused slots don't count for or against compliance
  c.compliancePct = counted ? Math.round((c.onTime / counted) * 100) : null;
}

function topKey(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  counts.forEach((n, k) => {
    if (n > bestN) [best, bestN] = [k, n];
  });
  return best ? `${best} (${bestN})` : null;
}

export async function buildMonthWorklog(monthStr: string): Promise<MonthWorklog> {
  const [year, month] = monthStr.split("-").map(Number);
  const start = lagosMidnightUTC(year, month, 1);
  const end = month === 12 ? lagosMidnightUTC(year + 1, 1, 1) : lagosMidnightUTC(year, month + 1, 1);

  const [records, finalized, ruleSet] = await Promise.all([
    prisma.slotRecord.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { slotIndex: "asc" }],
      select: {
        staffId: true, date: true, slotLabel: true, slotTime: true, outcome: true, tickedAt: true,
        note: true, link: true, reviewStatus: true, reviewReason: true,
        staff: { select: { fullName: true } },
      },
    }),
    prisma.payrollMonth.findUnique({ where: { month: monthStr }, select: { finalizedAt: true, lines: true } }),
    getRuleSetAt(new Date(Date.UTC(year, month - 1, 15))), // same mid-month choice as the payroll page
  ]);
  const config = ruleSet?.config as unknown as RuleSetConfig | undefined;
  const deductionsEnabled = config?.deductionsEnabled ?? false;
  const capPercent = config?.capPercent ?? 0;

  const staffIds = new Set(records.map((r) => r.staffId));
  const activeStaff = await prisma.staff.findMany({ where: { active: true }, select: { id: true } });
  activeStaff.forEach((s) => staffIds.add(s.id));
  const staffList = await prisma.staff.findMany({
    where: { id: { in: [...staffIds] } },
    select: { id: true, fullName: true, department: true },
    orderBy: { fullName: "asc" },
  });

  const totals = emptyCounts();
  const missedBySlot = new Map<string, number>();
  const missedByDay = new Map<string, number>();
  // Per-staff work runs in parallel (each is a chain of DB round trips). The counting
  // above the first await runs synchronously in list order, so shared totals are safe.
  const staff: StaffWorklog[] = await Promise.all(staffList.map(async (s): Promise<StaffWorklog> => {
    const mine = records.filter((r) => r.staffId === s.id);
    const counts = emptyCounts();
    const slotMiss = new Map<string, number>();
    const dayMiss = new Map<string, number>();
    for (const r of mine) {
      const k = classify(r);
      counts[k]++;
      totals[k]++;
      if (k === "missed") {
        const day = WEEKDAYS[lagosWeekday(r.date)];
        for (const [m, key] of [[slotMiss, r.slotLabel], [dayMiss, day], [missedBySlot, r.slotLabel], [missedByDay, day]] as const) {
          m.set(key, (m.get(key) ?? 0) + 1);
        }
      }
    }
    finishCounts(counts);

    const comp = await prisma.staffCompensation.findFirst({
      where: { staffId: s.id, effectiveFrom: { lt: end } },
      orderBy: { effectiveFrom: "desc" },
      select: { monthlySalaryKobo: true, grade: true },
    });
    const events = await getPayrollOffenceEvents(s.id, monthStr, comp?.grade ?? null);
    const categorized = categorizeOffences(events);
    const line = finalized?.finalizedAt ? finalized.lines.find((l) => l.staffId === s.id) : undefined;
    let deduction: StaffWorklog["deduction"] = null;
    if (line) {
      deduction = { breakdown: line.breakdown as unknown as PayrollBreakdown, source: "finalized" };
    } else if (comp) {
      deduction = { breakdown: calculatePayroll(events, comp.monthlySalaryKobo, capPercent, deductionsEnabled), source: "provisional" };
    }

    const flags: string[] = [];
    if (counts.missed >= 3) flags.push(`${counts.missed} missed updates`);
    if (counts.falseCount > 0) flags.push(`${counts.falseCount} false submission${counts.falseCount === 1 ? "" : "s"}`);
    const b = deduction?.breakdown;
    if (b && b.capKobo > 0) {
      if (b.capped) flags.push("Hit the deduction cap");
      else if (b.totalBeforeCapKobo >= b.capKobo * NEAR_CAP_RATIO) flags.push("Near the deduction cap");
    }
    const lateClockIns = events.filter((e) => e.type === "LATE_CLOCK_IN").length;
    if (counts.total > 0 && counts.late + counts.missed + counts.falseCount === 0 && lateClockIns === 0) flags.push("Clean record");

    return {
      staffId: s.id,
      name: s.fullName,
      department: s.department,
      counts,
      mostMissedSlot: topKey(slotMiss),
      mostMissedWeekday: topKey(dayMiss),
      lateClockIns,
      warnings: categorized.filter((c) => c.isWarning).length,
      offences: categorized.length,
      deduction,
      flags,
    };
  }));
  finishCounts(totals);

  return {
    monthStr,
    deductionsEnabled,
    capPercent,
    staff,
    totals,
    mostMissedSlot: topKey(missedBySlot),
    mostMissedWeekday: topKey(missedByDay),
    rows: records.map((r) => ({
      date: r.date,
      staff: r.staff.fullName,
      slot: r.slotLabel,
      slotTime: r.slotTime,
      outcome: r.outcome,
      tickedAt: r.tickedAt,
      note: r.note,
      link: r.link,
      reviewStatus: r.reviewStatus,
      reviewReason: r.reviewReason,
    })),
  };
}

const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Attendance for the report. A day counts as expected for a staff member only if it
 * has already happened (today counts once they've clocked in), is a working weekday
 * under the rule set in force that day (Mon-Fri if none), isn't a non-working day,
 * is on/after their start date and the worklog module start date, and isn't excused
 * leave (every work-update slot that day excused). Absent = expected days without a
 * clock-in. The stored summary used by "Generate report" is unchanged.
 */
export async function buildReportAttendance(year: number, month: number): Promise<ReportAttendance> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const lagosStart = lagosMidnightUTC(year, month, 1);
  const lagosEnd = month === 12 ? lagosMidnightUTC(year + 1, 1, 1) : lagosMidnightUTC(year, month + 1, 1);
  const todayStr = lagosDateStr(new Date());
  const worklogOn = isWorklogEnabled();

  const [staff, records, nonWorking, settings, slots, ruleSets] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, select: { id: true, fullName: true, department: true, dateJoined: true }, orderBy: { fullName: "asc" } }),
    prisma.attendance.findMany({ where: { date: { gte: start, lt: end } }, select: { staffId: true, date: true, status: true } }),
    prisma.nonWorkingDay.findMany({ where: { date: { gte: lagosStart, lt: lagosEnd } }, select: { date: true } }),
    worklogOn ? prisma.worklogSettings.findUnique({ where: { id: 1 }, select: { startDate: true } }) : null,
    prisma.slotRecord.findMany({ where: { date: { gte: lagosStart, lt: lagosEnd } }, select: { staffId: true, date: true, reviewStatus: true } }),
    // Loaded once and resolved per day in memory — same selection as getRuleSetAt().
    worklogOn
      ? prisma.worklogRuleSet.findMany({
          where: { effectiveFrom: { lt: lagosEnd }, supersededAt: null },
          orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
          select: { effectiveFrom: true, config: true },
        })
      : [],
  ]);
  const nonWorkingSet = new Set(nonWorking.map((d) => lagosDateStr(d.date)));
  const moduleStart = worklogOn && settings?.startDate ? lagosDateStr(settings.startDate) : null;

  // Excused leave: a staff/day where every slot row is EXCUSED.
  const slotDays = new Map<string, { total: number; excused: number }>();
  for (const r of slots) {
    const k = `${r.staffId}|${lagosDateStr(r.date)}`;
    const e = slotDays.get(k) ?? { total: 0, excused: 0 };
    e.total++;
    if (r.reviewStatus === "EXCUSED") e.excused++;
    slotDays.set(k, e);
  }

  // Calendar days that have happened, each with whether it's a working day.
  const days: { str: string; working: boolean }[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const str = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (str > todayStr) break;
    const weekday = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    const dayKey = lagosMidnightUTC(year, month, d);
    const rs = ruleSets.find((r) => r.effectiveFrom.getTime() <= dayKey.getTime());
    const weekdays = (rs?.config as unknown as RuleSetConfig | undefined)?.workingWeekdays ?? DEFAULT_WORKING_WEEKDAYS;
    days.push({ str, working: weekdays.includes(weekday) && !nonWorkingSet.has(str) && (!moduleStart || str >= moduleStart) });
  }

  const perStaff = staff.map((s) => {
    const mine = records.filter((r) => r.staffId === s.id);
    // Attendance.date is midnight UTC of the calendar day (see dayKey()).
    const byDay = new Map(mine.map((r) => [r.date.toISOString().slice(0, 10), r.status]));
    const joined = lagosDateStr(s.dateJoined);
    let expectedDays = 0;
    let presentDays = 0;
    for (const d of days) {
      if (!d.working || d.str < joined) continue;
      const sd = slotDays.get(`${s.id}|${d.str}`);
      if (sd && sd.total > 0 && sd.excused === sd.total) continue; // excused leave
      const present = byDay.has(d.str) && byDay.get(d.str) !== "ABSENT";
      if (d.str === todayStr && !present) continue; // today only counts once they've clocked in
      expectedDays++;
      if (present) presentDays++;
    }
    return {
      name: s.fullName,
      department: s.department,
      onTime: mine.filter((r) => r.status === "ON_TIME").length,
      late: mine.filter((r) => r.status === "LATE").length,
      absent: expectedDays - presentDays,
      anomalies: mine.filter((r) => r.status === "ANOMALY").length,
      expectedDays,
      attendancePct: expectedDays ? Math.round((presentDays / expectedDays) * 100) : null,
    };
  });

  const counted = perStaff.filter((p) => p.attendancePct !== null);
  return {
    periodLabel: `${year}-${String(month).padStart(2, "0")}`,
    totalStaff: staff.length,
    overallAttendancePct: counted.length ? Math.round(counted.reduce((a, p) => a + (p.attendancePct ?? 0), 0) / counted.length) : null,
    totalLate: perStaff.reduce((a, p) => a + p.late, 0),
    totalAbsent: perStaff.reduce((a, p) => a + p.absent, 0),
    totalAnomalies: perStaff.reduce((a, p) => a + p.anomalies, 0),
    perStaff,
  };
}

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

function plainSummary(r: Omit<FullReport, "summary">): string[] {
  const a = r.attendance;
  const out = [
    a.overallAttendancePct === null
      ? `${r.monthLabel}: ${a.totalStaff} active staff; no working days counted towards attendance yet.`
      : `${r.monthLabel}: ${a.totalStaff} active staff, average attendance ${a.overallAttendancePct}% of expected working days, with ${a.totalLate} late clock-ins and ${a.totalAbsent} absences.`,
  ];
  const w = r.worklog;
  if (!w) return out;
  if (!w.totals.total) {
    out.push("No work updates were recorded this month.");
    return out;
  }
  out.push(
    `Work updates: ${w.totals.compliancePct}% of ${w.totals.total - w.totals.excused} non-excused slots were submitted on time (${w.totals.late} late, ${w.totals.missed} missed, ${w.totals.falseCount} false, ${w.totals.excused} excused).`
  );
  const prevPct = r.previous?.totals.compliancePct;
  if (prevPct != null && w.totals.compliancePct != null) {
    const diff = w.totals.compliancePct - prevPct;
    out.push(diff === 0 ? `Compliance is unchanged from last month (${prevPct}%).` : `Compliance is ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} points from last month (${prevPct}%).`);
  }
  if (w.mostMissedSlot) out.push(`The most-missed slot was ${w.mostMissedSlot}, and the most-missed day was ${w.mostMissedWeekday}.`);
  const deductTotal = w.staff.reduce((s, x) => s + (x.deduction?.breakdown.totalDeductionKobo ?? 0), 0);
  if (deductTotal > 0) {
    out.push(
      w.deductionsEnabled
        ? `Deductions total ${naira(deductTotal)} across staff.`
        : `Deductions were in warning-only mode: ${naira(deductTotal)} would have been deducted, but nothing was taken from pay.`
    );
  }
  const attention = w.staff.filter((s) => s.flags.some((f) => f !== "Clean record")).map((s) => s.name);
  const clean = w.staff.filter((s) => s.flags.includes("Clean record")).map((s) => s.name);
  if (attention.length) out.push(`Needs attention: ${attention.join(", ")}.`);
  if (clean.length) out.push(`Clean records: ${clean.join(", ")}.`);
  if (w.totals.pending) out.push(`${w.totals.pending} slot(s) were still unmarked by the system and are not counted above.`);
  return out;
}

export async function buildFullReport(monthStr: string): Promise<FullReport> {
  const [year, month] = monthStr.split("-").map(Number);
  const worklogOn = isWorklogEnabled();
  const [attendance, worklog, previous] = await Promise.all([
    buildReportAttendance(year, month),
    worklogOn ? buildMonthWorklog(monthStr) : null,
    worklogOn ? buildMonthWorklog(prevMonthStr(monthStr)) : null,
  ]);
  const base = { monthStr, monthLabel: monthLabel(monthStr), generatedAt: new Date(), attendance, worklog, previous };
  return { ...base, summary: plainSummary(base) };
}
