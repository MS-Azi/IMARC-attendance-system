/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/lagos.test.ts
 * (No test framework is configured in this project yet — these are plain assertion
 * scripts, run the same way prisma/seed.ts is.)
 */
import {
  lagosDateKey,
  lagosDateStr,
  lagosMonthStr,
  lagosMidnightUTC,
  lagosWeekday,
  minutesSinceMidnightLagos,
  firstOfNextMonthLagos,
  parseHHMM,
  minutesToHHMM,
} from "../../lib/worklog/lagos";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

console.log("\n[1] Midnight boundary: UTC 23:30 (previous day) is Lagos 00:30 (already next day)");
const nearMidnight = new Date("2026-09-21T23:30:00.000Z");
assert(lagosDateStr(nearMidnight) === "2026-09-22", "lagosDateStr rolls over to Sep 22, got " + lagosDateStr(nearMidnight));
assert(
  lagosDateKey(nearMidnight).toISOString() === "2026-09-21T23:00:00.000Z",
  "lagosDateKey = Lagos midnight for Sep 22 (= UTC 23:00 Sep 21), got " + lagosDateKey(nearMidnight).toISOString()
);

console.log("\n[2] The naive UTC-date bug this deliberately avoids");
const naiveUTCBucket = new Date(Date.UTC(2026, 8, 21)).toISOString();
assert(lagosDateKey(nearMidnight).toISOString() !== naiveUTCBucket, "lagosDateKey differs from naive UTC-date bucketing at this instant");

console.log("\n[3] Just before the boundary: UTC 22:59 is still Lagos Sep 21 (23:59)");
const justBefore = new Date("2026-09-21T22:59:00.000Z");
assert(lagosDateStr(justBefore) === "2026-09-21", "still Sep 21 Lagos, got " + lagosDateStr(justBefore));
assert(minutesSinceMidnightLagos(justBefore) === 23 * 60 + 59, "23:59 Lagos = minute 1439, got " + minutesSinceMidnightLagos(justBefore));

console.log("\n[4] Round-trip: lagosMidnightUTC(y,m,d) fed back through lagosDateKey returns itself");
const midnight = lagosMidnightUTC(2026, 9, 22);
assert(lagosDateKey(midnight).getTime() === midnight.getTime(), "round-trips exactly");
assert(lagosDateStr(midnight) === "2026-09-22", "formats back to the same date, got " + lagosDateStr(midnight));

console.log("\n[5] Lagos has no DST — offset is a flat 1 hour year-round");
const june = lagosMidnightUTC(2026, 6, 15);
const december = lagosMidnightUTC(2026, 12, 15);
const juneOffsetMs = new Date(Date.UTC(2026, 5, 15, 0, 0, 0)).getTime() - june.getTime();
const decOffsetMs = new Date(Date.UTC(2026, 11, 15, 0, 0, 0)).getTime() - december.getTime();
assert(juneOffsetMs === 3600000, "June offset is exactly +1h, got " + juneOffsetMs / 60000 + "min");
assert(decOffsetMs === 3600000, "December offset is exactly +1h, got " + decOffsetMs / 60000 + "min");

console.log("\n[6] Weekday near midnight boundary");
assert(lagosWeekday(nearMidnight) === 2, "Sep 22 2026 is a Tuesday (2), got " + lagosWeekday(nearMidnight));
assert(lagosWeekday(justBefore) === 1, "Sep 21 2026 is a Monday (1), got " + lagosWeekday(justBefore));

console.log("\n[7] Month string near a month boundary");
const monthBoundary = new Date("2026-09-30T23:30:00.000Z");
assert(lagosMonthStr(monthBoundary) === "2026-10", "rolls to October, got " + lagosMonthStr(monthBoundary));

console.log("\n[8] firstOfNextMonthLagos near month boundary");
const next = firstOfNextMonthLagos(monthBoundary);
assert(lagosMonthStr(next) === "2026-11", "from late Sep 30 (Lagos Oct 1), next month is November, got " + lagosMonthStr(next));

console.log("\n[9] parseHHMM / minutesToHHMM round-trip incl. midnight-adjacent values");
assert(parseHHMM("00:00") === 0, "00:00 -> 0");
assert(parseHHMM("23:59") === 1439, "23:59 -> 1439");
assert(minutesToHHMM(0) === "00:00", "0 -> 00:00");
assert(minutesToHHMM(1439) === "23:59", "1439 -> 23:59");
assert(minutesToHHMM(parseHHMM("08:21")) === "08:21", "round-trip 08:21");

console.log("\nALL CHECKS PASSED");
