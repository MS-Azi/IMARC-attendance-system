import { prisma } from "@/lib/db";
import { RuleSetConfig, DEFAULT_GRADE_KEY } from "./config";
import { lagosDateKey } from "./lagos";
import { getRuleSetAt } from "./rules";
import { calculatePayroll, PayrollOffenceEvent, PayrollBreakdown } from "./payroll";

/** Gathers one staff member's confirmed, non-excused offences for a month, each
 * carrying the tier ladder that actually applied to it (its own rule-set version,
 * staff's grade at the time) — the DB-touching counterpart to the pure engine. */
async function getPayrollOffenceEvents(staffId: string, monthStr: string, grade: string | null): Promise<PayrollOffenceEvent[]> {
  const [year, month] = monthStr.split("-").map(Number);
  const start = lagosDateKey(new Date(Date.UTC(year, month - 1, 1)));
  const end = lagosDateKey(new Date(Date.UTC(year, month, 1)));
  const attStart = new Date(Date.UTC(year, month - 1, 1));
  const attEnd = new Date(Date.UTC(year, month, 1));

  const gradeKey = grade ?? DEFAULT_GRADE_KEY;
  const events: PayrollOffenceEvent[] = [];

  const slotRecords = await prisma.slotRecord.findMany({
    where: { staffId, date: { gte: start, lt: end } },
    include: { ruleSet: true },
  });
  for (const r of slotRecords) {
    const config = r.ruleSet.config as unknown as RuleSetConfig;
    const ladder = config.tierLadders[config.amountsApply === "BY_GRADE" ? gradeKey : DEFAULT_GRADE_KEY];
    let type: PayrollOffenceEvent["type"] | null = null;
    if (r.reviewStatus === "FALSE") type = "FALSE_SUBMISSION";
    else if (r.reviewStatus === "VALID" && r.outcome === "MISSED") type = "MISSED_SUBMISSION";
    else if (r.reviewStatus === "VALID" && r.outcome === "LATE") type = "LATE_SUBMISSION";
    if (!type) continue;
    events.push({
      type,
      ruleSetId: r.ruleSetId,
      warningAllowance: config.warningAllowance[type],
      occurredAt: r.tickedAt ?? r.updatedAt,
      tiers: ladder?.[type] ?? [],
    });
  }

  const lateAttendance = await prisma.attendance.findMany({
    where: { staffId, date: { gte: attStart, lt: attEnd }, status: "LATE" },
    include: { offenceReview: true },
  });
  for (const a of lateAttendance) {
    if (a.offenceReview) continue;
    const ruleSet = await getRuleSetAt(a.date);
    if (!ruleSet) continue;
    const config = ruleSet.config as unknown as RuleSetConfig;
    const ladder = config.tierLadders[config.amountsApply === "BY_GRADE" ? gradeKey : DEFAULT_GRADE_KEY];
    events.push({
      type: "LATE_CLOCK_IN",
      ruleSetId: ruleSet.id,
      warningAllowance: config.warningAllowance.LATE_CLOCK_IN,
      occurredAt: a.clockIn ?? a.date,
      tiers: ladder?.LATE_CLOCK_IN ?? [],
    });
  }

  return events;
}

export type StaffPayrollLine = {
  staffId: string;
  staffName: string;
  baseKobo: number;
  deductionsEnabled: boolean;
  breakdown: PayrollBreakdown;
};

export async function computeStaffPayroll(staffId: string, monthStr: string): Promise<StaffPayrollLine | null> {
  const [year, month] = monthStr.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const [staff, comp, ruleSet] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.staffCompensation.findFirst({ where: { staffId, effectiveFrom: { lt: monthEnd } }, orderBy: { effectiveFrom: "desc" } }),
    getRuleSetAt(new Date(Date.UTC(year, month - 1, 15))), // mid-month, for capPercent/deductionsEnabled — a split month uses per-offence tiers regardless
  ]);
  if (!staff || !comp) return null; // no salary on file — nothing to compute

  const config = ruleSet?.config as unknown as RuleSetConfig | undefined;
  const deductionsEnabled = config?.deductionsEnabled ?? false;
  const events = await getPayrollOffenceEvents(staffId, monthStr, comp.grade);
  const breakdown = calculatePayroll(events, comp.monthlySalaryKobo, config?.capPercent ?? 0, deductionsEnabled);

  return { staffId, staffName: staff.fullName, baseKobo: comp.monthlySalaryKobo, deductionsEnabled, breakdown };
}

export async function computeMonthPayroll(monthStr: string): Promise<StaffPayrollLine[]> {
  const staffList = await prisma.staff.findMany({ where: { active: true } });
  const lines: StaffPayrollLine[] = [];
  for (const s of staffList) {
    const line = await computeStaffPayroll(s.id, monthStr);
    if (line) lines.push(line);
  }
  return lines;
}
