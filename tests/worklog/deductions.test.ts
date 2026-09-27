/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/deductions.test.ts
 */
import { categorizeOffences, countWarnings, OffenceEvent } from "../../lib/worklog/deductions";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

function offence(type: OffenceEvent["type"], day: number, ruleSetId = "rs1", warningAllowance = 2): OffenceEvent {
  return { type, ruleSetId, warningAllowance, occurredAt: new Date(2026, 8, day) };
}

console.log("\n[1] First N offences (N = warningAllowance) are warnings, the rest aren't");
const eight = Array.from({ length: 8 }, (_, i) => offence("MISSED_SUBMISSION", i + 1));
const categorized = categorizeOffences(eight);
assert(categorized.map((o) => o.ordinal).join(",") === "1,2,3,4,5,6,7,8", "ordinals assigned in time order");
assert(categorized.filter((o) => o.isWarning).length === 2, "exactly 2 warnings (allowance = 2), got " + categorized.filter((o) => o.isWarning).length);
assert(categorized[0].isWarning && categorized[1].isWarning, "offences #1-2 are warnings");
assert(!categorized[2].isWarning, "offence #3 is not a warning");

console.log("\n[2] countWarnings matches the worked spec example's warning count (2)");
assert(countWarnings(eight) === 2, "got " + countWarnings(eight));

console.log("\n[3] Zero warning allowance means every offence is chargeable");
const noAllowance = Array.from({ length: 3 }, (_, i) => offence("LATE_SUBMISSION", i + 1, "rs1", 0));
assert(countWarnings(noAllowance) === 0, "got " + countWarnings(noAllowance));

console.log("\n[4] Different offence types are counted independently");
const mixed = [
  offence("LATE_SUBMISSION", 1, "rs1", 1),
  offence("LATE_SUBMISSION", 2, "rs1", 1),
  offence("MISSED_SUBMISSION", 3, "rs1", 1),
  offence("MISSED_SUBMISSION", 4, "rs1", 1),
];
assert(countWarnings(mixed) === 2, "1 warning per type = 2 total, got " + countWarnings(mixed));

console.log("\n[5] A mid-period rule-set change restarts the warning count for the new version");
const acrossVersions = [
  offence("MISSED_SUBMISSION", 1, "rsA", 2),
  offence("MISSED_SUBMISSION", 2, "rsA", 2),
  offence("MISSED_SUBMISSION", 3, "rsA", 2), // 3rd under rsA -> not a warning
  offence("MISSED_SUBMISSION", 10, "rsB", 2), // 1st under rsB -> warning again
  offence("MISSED_SUBMISSION", 11, "rsB", 2), // 2nd under rsB -> warning
];
const cat2 = categorizeOffences(acrossVersions);
assert(cat2.filter((o) => o.isWarning).length === 4, "2 warnings per version x 2 versions = 4, got " + cat2.filter((o) => o.isWarning).length);
assert(!cat2[2].isWarning, "3rd offence under rsA is chargeable, not a warning");
assert(cat2[3].isWarning, "1st offence under rsB is a fresh warning");

console.log("\n[6] Input order doesn't matter — offences are sorted internally by time");
const shuffled = [eight[5], eight[0], eight[7], eight[1]];
const catShuffled = categorizeOffences(shuffled);
assert(catShuffled[0].ordinal === 1 && catShuffled[1].ordinal === 2, "re-sorted correctly by occurredAt");

console.log("\nALL CHECKS PASSED");
