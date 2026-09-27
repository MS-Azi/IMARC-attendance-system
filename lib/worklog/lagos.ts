/**
 * Every worklog day boundary, slot window, and monthly period is computed in
 * Africa/Lagos wall-clock time, then stored as its correct UTC instant. This is
 * the single place that logic lives — nothing else in this module should touch
 * Date components (getUTCHours etc.) directly.
 *
 * The existing attendance module's dayKey() buckets by raw UTC calendar date,
 * which is subtly wrong for the ~1 hour a day where the Lagos calendar date has
 * already rolled over but the UTC one hasn't (Lagos 00:00-00:59 = UTC 23:00-23:59
 * the previous day, since Lagos is UTC+1). We deliberately don't reuse dayKey()
 * for that reason — see lagosDateKey() below.
 */

export const TIMEZONE = "Africa/Lagos";

type DateParts = { year: number; month: number; day: number; hour: number; minute: number };

function parts(date: Date, timeZone: string = TIMEZONE): DateParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(formatted.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Offset (in minutes) of `timeZone` from UTC at the given instant. Positive east of UTC. */
function timeZoneOffsetMinutes(date: Date, timeZone: string = TIMEZONE): number {
  const p = parts(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Minutes since midnight, Lagos wall-clock time. */
export function minutesSinceMidnightLagos(date: Date): number {
  const p = parts(date);
  return p.hour * 60 + p.minute;
}

/** "YYYY-MM-DD" in Lagos. */
export function lagosDateStr(date: Date): string {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "YYYY-MM" in Lagos. */
export function lagosMonthStr(date: Date): string {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** The UTC instant corresponding to a given Lagos calendar date's midnight. */
export function lagosMidnightUTC(year: number, month: number, day: number): Date {
  const approx = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMin = timeZoneOffsetMinutes(approx);
  return new Date(approx.getTime() - offsetMin * 60000);
}

/** The worklog equivalent of dayKey(): midnight UTC of the Lagos calendar day containing `date`. */
export function lagosDateKey(date: Date = new Date()): Date {
  const p = parts(date);
  return lagosMidnightUTC(p.year, p.month, p.day);
}

/** 0 = Sunday .. 6 = Saturday, Lagos-local. */
export function lagosWeekday(date: Date): number {
  const p = parts(date);
  // Day-of-week is a property of the calendar date itself, so once we have the
  // Lagos Y/M/D, reading it back as UTC midnight gives the correct weekday.
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Midnight UTC of the 1st of the Lagos calendar month following `from`. */
export function firstOfNextMonthLagos(from: Date = new Date()): Date {
  const p = parts(from);
  let year = p.year;
  let month = p.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return lagosMidnightUTC(year, month, 1);
}

/** "HH:mm" -> minutes since midnight. */
export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:mm". */
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
