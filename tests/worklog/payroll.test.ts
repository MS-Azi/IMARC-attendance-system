/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/payroll.test.ts
 */
import { calculatePayroll, PayrollOffenceEvent } from "../../lib/worklog/payroll";
import { TierRow } from "../../lib/worklog/config";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}
function naira(n: number) {
  return n * 100;
} // kobo

const missedTiers: TierRow[] = [
  { fromCount: 1, toCount: 3, amountKobo: naira(1000) },
  { fromCount: 4, toCount: 6, amountKobo: naira(2000) },
  { fromCount: 7, toCount: null, amountKobo: naira(4000) },
];

function missedOffences(count: number, ruleSetId = "rs1", tiers = missedTiers): PayrollOffenceEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "MISSED_SUBMISSION" as const,
    ruleSetId,
    warningAllowance: 2,
    occurredAt: new Date(2026, 8, i + 1),
    tiers,
  }));
}

console.log("\n[1] Spec's worked example: salary ₦300,000, cap 10%, 8 missed -> ₦15,000 deduction");
const r1 = calculatePayroll(missedOffences(8), naira(300000), 10, true);
assert(r1.subtotals.MISSED_SUBMISSION === naira(15000), "subtotal ₦15,000, got " + r1.subtotals.MISSED_SUBMISSION / 100);
assert(r1.totalBeforeCapKobo === naira(15000), "totalBeforeCap ₦15,000");
assert(r1.capKobo === naira(30000), "cap is ₦30,000 (10% of 300k)");
assert(!r1.capped, "not capped (15,000 < 30,000)");
assert(r1.totalDeductionKobo === naira(15000), "deduction ₦15,000");
assert(r1.netKobo === naira(285000), "net ₦285,000, got " + r1.netKobo / 100);

console.log("\n[2] Cap hit: enough offences to exceed the cap");
const r2 = calculatePayroll(missedOffences(20), naira(300000), 10, true);
// #1-2 warn, #3-6 @1000x1(no,#3 is in 1-3 tier=1000)... just check totals directly:
// #3:1000 #4-6:2000x3=6000 #7-20(14 offences)x4000=56000 => before cap = 1000+6000+56000=63000
assert(r2.totalBeforeCapKobo === naira(63000), "totalBeforeCap ₦63,000, got " + r2.totalBeforeCapKobo / 100);
assert(r2.capped, "capped (63,000 > 30,000)");
assert(r2.totalDeductionKobo === naira(30000), "deduction clamped to the ₦30,000 cap");
assert(r2.netKobo === naira(270000), "net ₦270,000 (salary - cap)");

console.log("\n[3] Offences keep being counted past the cap (subtotal still reflects all of them)");
assert(r2.subtotals.MISSED_SUBMISSION === naira(63000), "full uncapped subtotal preserved for visibility");

console.log("\n[4] Zero warning allowance -> every offence is chargeable from #1");
const zeroWarn: PayrollOffenceEvent[] = Array.from({ length: 3 }, (_, i) => ({
  type: "LATE_SUBMISSION" as const,
  ruleSetId: "rs1",
  warningAllowance: 0,
  occurredAt: new Date(2026, 8, i + 1),
  tiers: [{ fromCount: 1, toCount: null, amountKobo: naira(500) }],
}));
const r4 = calculatePayroll(zeroWarn, naira(100000), 100, true);
assert(r4.subtotals.LATE_SUBMISSION === naira(1500), "3 x ₦500 = ₦1,500, got " + r4.subtotals.LATE_SUBMISSION / 100);

console.log("\n[5] Open-ended tier (toCount: null) covers every count from its fromCount up");
const openEnded = calculatePayroll(missedOffences(50), naira(1000000), 100, true);
// #7-50 = 44 offences @ 4000 = 176000; + #3:1000 + #4-6:6000 = 183000
assert(openEnded.subtotals.MISSED_SUBMISSION === naira(183000), "got " + openEnded.subtotals.MISSED_SUBMISSION / 100);

console.log("\n[6] BY_GRADE — different offences carrying different tier tables (already resolved per-offence)");
const juniorTiers: TierRow[] = [{ fromCount: 1, toCount: null, amountKobo: naira(500) }];
const seniorTiers: TierRow[] = [{ fromCount: 1, toCount: null, amountKobo: naira(2000) }];
const mixedGrades: PayrollOffenceEvent[] = [
  { type: "FALSE_SUBMISSION", ruleSetId: "rs1", warningAllowance: 0, occurredAt: new Date(2026, 8, 1), tiers: juniorTiers },
];
const rJunior = calculatePayroll(mixedGrades, naira(100000), 100, true);
assert(rJunior.subtotals.FALSE_SUBMISSION === naira(500), "junior-grade tier applied, got " + rJunior.subtotals.FALSE_SUBMISSION / 100);
const rSenior = calculatePayroll([{ ...mixedGrades[0], tiers: seniorTiers }], naira(100000), 100, true);
assert(rSenior.subtotals.FALSE_SUBMISSION === naira(2000), "senior-grade tier applied to the same offence shape, got " + rSenior.subtotals.FALSE_SUBMISSION / 100);

console.log("\n[7] Mid-month apply-immediately split: warning count restarts under the new rule-set version");
const preSplit = missedOffences(2, "rsA"); // #1-2 under rsA, both warnings (allowance 2)
const postSplit = missedOffences(2, "rsB"); // #1-2 under rsB, ALSO both warnings, fresh count
const split = [...preSplit, ...postSplit];
const rSplit = calculatePayroll(split, naira(200000), 10, true);
assert(rSplit.subtotals.MISSED_SUBMISSION === 0, "all 4 offences are warnings (2 per version) -> ₦0 charged, got " + rSplit.subtotals.MISSED_SUBMISSION / 100);

console.log("\n[8] Deductions disabled: figures still computed, but net is untouched (\"would have been\")");
const r8 = calculatePayroll(missedOffences(8), naira(300000), 10, false);
assert(r8.totalDeductionKobo === naira(15000), "deduction still computed (₦15,000) for display");
assert(r8.netKobo === naira(300000), "net = full salary when deductions are off, got " + r8.netKobo / 100);

console.log("\nALL CHECKS PASSED");
