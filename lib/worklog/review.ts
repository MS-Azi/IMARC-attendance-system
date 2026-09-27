import { prisma } from "@/lib/db";
import { dayKey as attendanceDayKey } from "@/lib/attendance";
import { RuleSetConfig } from "./config";
import { computeSlotWindows } from "./validate";
import { lagosDateKey } from "./lagos";
import { ensureSlotRecordsForDate, deriveDisplayStatusAt, lagosTimeOnDay } from "./slots";
import { writeAuditLog } from "@/lib/audit";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getReviewBoardForDate(date: Date) {
  const staffList = await prisma.staff.findMany({ where: { active: true }, orderBy: { fullName: "asc" } });
  const dayKey = lagosDateKey(date);
  const attDayKey = attendanceDayKey(date);
  const staffIds = staffList.map((s) => s.id);

  // Lazily create today's/this-date's slot records for every active staff member —
  // otherwise a staff member who never opens the app that day is invisible on the
  // board instead of showing as missed. (The Phase 4 cron will do this in bulk too.)
  for (const id of staffIds) {
    await ensureSlotRecordsForDate(id, date, { allowFuture: false });
  }

  const [slotRecords, attendanceRecords] = await Promise.all([
    prisma.slotRecord.findMany({
      where: { date: dayKey, staffId: { in: staffIds } },
      include: { ruleSet: true },
      orderBy: { slotIndex: "asc" },
    }),
    prisma.attendance.findMany({
      where: { date: attDayKey, staffId: { in: staffIds } },
      include: { offenceReview: true },
    }),
  ]);

  const now = new Date();
  const attendanceByStaff = new Map(attendanceRecords.map((a) => [a.staffId, a]));
  const slotsByStaff = new Map<string, typeof slotRecords>();
  for (const r of slotRecords) {
    if (!slotsByStaff.has(r.staffId)) slotsByStaff.set(r.staffId, []);
    slotsByStaff.get(r.staffId)!.push(r);
  }

  const rows = staffList.map((s) => {
    const slots = (slotsByStaff.get(s.id) ?? []).map((r) => {
      const config = r.ruleSet.config as unknown as RuleSetConfig;
      const windows = computeSlotWindows(config);
      const w = windows[r.slotIndex] ?? windows[windows.length - 1];
      const opensAt = lagosTimeOnDay(r.date, w.opens);
      const onTimeClosesAt = lagosTimeOnDay(r.date, w.onTimeCloses);
      const lateClosesAt = lagosTimeOnDay(r.date, w.lateCloses);
      return {
        id: r.id,
        slotIndex: r.slotIndex,
        label: r.slotLabel,
        status: deriveDisplayStatusAt(r, { opensAt, onTimeClosesAt, lateClosesAt }, now),
        reviewStatus: r.reviewStatus,
        reviewReason: r.reviewReason,
        note: r.note,
        link: r.link,
        tickedAt: r.tickedAt?.toISOString() ?? null,
      };
    });

    const attendance = attendanceByStaff.get(s.id);
    return {
      staffId: s.id,
      staffName: s.fullName,
      department: s.department,
      clockIn: attendance?.clockIn?.toISOString() ?? null,
      clockInStatus: attendance?.status ?? null,
      clockInExcused: !!attendance?.offenceReview,
      attendanceId: attendance?.id ?? null,
      slots,
    };
  });

  const flatSlots = rows.flatMap((r) => r.slots);
  const summary = {
    total: flatSlots.length,
    onTime: flatSlots.filter((x) => x.status === "ON_TIME").length,
    late: flatSlots.filter((x) => x.status === "LATE").length,
    missed: flatSlots.filter((x) => x.status === "MISSED").length,
  };

  return { rows, summary };
}

export async function reviewSlot(
  slotRecordId: string,
  action: "FALSE" | "EXCUSE" | "UNDO",
  reason: string | undefined,
  adminId: string
) {
  const record = await prisma.slotRecord.findUnique({ where: { id: slotRecordId } });
  if (!record) throw new Error("Slot record not found.");
  if (action === "EXCUSE" && !reason?.trim()) throw new Error("A reason is required to excuse a slot.");

  const before = { reviewStatus: record.reviewStatus, reviewReason: record.reviewReason };
  const newStatus: "VALID" | "FALSE" | "EXCUSED" = action === "UNDO" ? "VALID" : action === "FALSE" ? "FALSE" : "EXCUSED";
  const data =
    action === "UNDO"
      ? { reviewStatus: newStatus, reviewReason: null, reviewedById: null, reviewedAt: null }
      : { reviewStatus: newStatus, reviewReason: reason?.trim() || null, reviewedById: adminId, reviewedAt: new Date() };

  const updated = await prisma.slotRecord.update({ where: { id: slotRecordId }, data });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: adminId,
    action: `worklog_slot.${action.toLowerCase()}`,
    entityType: "SlotRecord",
    entityId: slotRecordId,
    before,
    after: { reviewStatus: updated.reviewStatus, reviewReason: updated.reviewReason },
    reason,
  });

  return updated;
}

/** Excuses every slot in [from, to] for one staff member — for approved leave. Creates
 * the underlying slot records first if they don't exist yet (e.g. future-dated leave). */
export async function bulkExcuseRange(staffId: string, from: Date, to: Date, reason: string, adminId: string) {
  if (!reason?.trim()) throw new Error("A reason is required.");
  const fromKey = lagosDateKey(from);
  const toKey = lagosDateKey(to);
  if (fromKey > toKey) throw new Error("'From' date must be on or before 'to' date.");

  const touchedDays: string[] = [];
  for (let d = fromKey; d <= toKey; d = new Date(d.getTime() + DAY_MS)) {
    const ensured = await ensureSlotRecordsForDate(staffId, d);
    if (!ensured) continue; // not a working day, or no rule set in force on that date
    await prisma.slotRecord.updateMany({
      where: { staffId, date: ensured.dayKey, reviewStatus: { not: "EXCUSED" } },
      data: { reviewStatus: "EXCUSED", reviewReason: reason.trim(), reviewedById: adminId, reviewedAt: new Date() },
    });
    touchedDays.push(ensured.dayKey.toISOString());
  }

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: adminId,
    action: "worklog_slot.bulk_excuse",
    entityType: "Staff",
    entityId: staffId,
    after: { from: fromKey.toISOString(), to: toKey.toISOString(), days: touchedDays },
    reason,
  });

  return touchedDays;
}

export async function excuseAttendanceLate(attendanceId: string, reason: string, adminId: string) {
  if (!reason?.trim()) throw new Error("A reason is required.");
  const existing = await prisma.attendanceOffenceReview.findUnique({ where: { attendanceRecordId: attendanceId } });
  if (existing) return existing;

  const review = await prisma.attendanceOffenceReview.create({
    data: { attendanceRecordId: attendanceId, reason: reason.trim(), reviewedById: adminId },
  });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: adminId,
    action: "attendance_offence.excuse",
    entityType: "Attendance",
    entityId: attendanceId,
    after: { reason: review.reason },
    reason,
  });

  return review;
}

export async function undoAttendanceExcuse(attendanceId: string, adminId: string) {
  const existing = await prisma.attendanceOffenceReview.findUnique({ where: { attendanceRecordId: attendanceId } });
  if (!existing) return null;

  await prisma.attendanceOffenceReview.delete({ where: { attendanceRecordId: attendanceId } });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: adminId,
    action: "attendance_offence.undo_excuse",
    entityType: "Attendance",
    entityId: attendanceId,
    before: { reason: existing.reason },
  });

  return existing;
}
