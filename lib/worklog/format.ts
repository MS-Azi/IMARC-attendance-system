/** Client-safe display formatting — always in Africa/Lagos time regardless of the
 * viewer's own device timezone, since that's the timezone the rules actually run in. */

const TIMEZONE = "Africa/Lagos";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6:29 PM" */
export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "27 Sep 2026" — built manually rather than via toLocaleDateString, whose month
 * abbreviations vary by locale/engine (e.g. en-GB renders "Sept", not "Sep"). */
export function fmtDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("day")} ${MONTHS[Number(get("month")) - 1]} ${get("year")}`;
}

/** "27 Sep 2026, 6:29 PM" */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

/** "14:30" -> "2:30 PM" — for the raw "HH:mm" slot-time strings (Lagos local, no date). */
export function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const OFFENCE_LABELS: Record<string, string> = {
  LATE_CLOCK_IN: "Late clock-in",
  LATE_SUBMISSION: "Late submission",
  MISSED_SUBMISSION: "Missed submission",
  FALSE_SUBMISSION: "False submission",
};
export function offenceLabel(type: string): string {
  return OFFENCE_LABELS[type] ?? type;
}

/** ₦1,000 */
export function fmtNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

type TierRowLike = { fromCount: number; toCount: number | null; amountKobo: number };

function tierRangeLabel(t: TierRowLike): string {
  if (t.toCount === null) return `${t.fromCount}+`;
  if (t.toCount === t.fromCount) return `${t.fromCount}`;
  return `${t.fromCount}-${t.toCount}`;
}

/** "1-3: ₦1,000 · 4-6: ₦2,000 · 7+: ₦4,000" */
export function summarizeLadder(tiers: TierRowLike[]): string {
  if (!tiers.length) return "No charge";
  return tiers.map((t) => `${tierRangeLabel(t)}: ${fmtNaira(t.amountKobo)}`).join(" · ");
}
