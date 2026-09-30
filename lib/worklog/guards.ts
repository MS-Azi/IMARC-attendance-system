/** Pure, DB-free guard logic for whether a slot record may be created for a given
 * staff member on a given date — shared by the review board and the cron, which are
 * the two places records get auto-generated (not by the staff-facing /today lazy
 * create, and not by admin bulk-excuse, which deliberately targets future dates for
 * planned leave). */

export type SlotCreationGuardInput = {
  /** Lagos calendar day in question, as a dayKey (UTC midnight of that Lagos day). */
  date: Date;
  /** dayKey of "now" — for the future-date check. */
  today: Date;
  /** Lagos weekday (0=Sun..6=Sat) of `date`. */
  weekday: number;
  workingWeekdays: number[];
  isNonWorkingDay: boolean;
  /** dayKey, or null if not yet configured — fail-safe: null blocks all creation. */
  worklogStartDate: Date | null;
  /** Staff.dateJoined. */
  staffDateJoined: Date;
  /** false for board/cron auto-generation; true for callers that legitimately target
   * future dates (e.g. admin bulk-excuse for planned leave). */
  allowFuture: boolean;
};

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

export function checkSlotCreationGuards(input: SlotCreationGuardInput): GuardResult {
  if (!input.workingWeekdays.includes(input.weekday)) {
    return { allowed: false, reason: "Not a working weekday." };
  }
  if (input.isNonWorkingDay) {
    return { allowed: false, reason: "Marked as a non-working day." };
  }
  if (!input.worklogStartDate) {
    return { allowed: false, reason: "Worklog start date is not configured yet." };
  }
  if (input.date.getTime() < input.worklogStartDate.getTime()) {
    return { allowed: false, reason: "Before the worklog start date." };
  }
  if (input.date.getTime() < input.staffDateJoined.getTime()) {
    return { allowed: false, reason: "Before this staff member's start date." };
  }
  if (!input.allowFuture && input.date.getTime() > input.today.getTime()) {
    return { allowed: false, reason: "Future date not allowed for auto-generated records." };
  }
  return { allowed: true };
}
