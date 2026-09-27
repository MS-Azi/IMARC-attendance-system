/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/validate.test.ts
 */
import { validateRuleSetConfig, computeSlotWindows } from "../../lib/worklog/validate";
import { defaultRuleSetConfig, DEFAULT_GRADE_KEY, RuleSetConfig } from "../../lib/worklog/config";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

console.log("\n[1] The default config (as shipped) is valid");
const base = defaultRuleSetConfig();
assert(validateRuleSetConfig(base).ok, "default config passes validation");

console.log("\n[2] Derived windows match the spec's definitions");
const windows = computeSlotWindows(base);
assert(windows[0].opens === 9 * 60 + 30, "10AM slot opens at 09:30, got minute " + windows[0].opens);
assert(windows[0].onTimeCloses === 10 * 60 + 15, "10AM slot on-time closes at 10:15");
assert(windows[0].lateCloses === windows[1].opens, "10AM slot's late-close is exactly the 12PM slot's opens");
const last = windows[windows.length - 1];
assert(last.lateCloses === 17 * 60 + 45, "last slot's late-close is lastSlotLateCloseTime (17:45)");

console.log("\n[3] Overlapping windows are rejected");
const overlapping: RuleSetConfig = {
  ...base,
  slots: [
    { label: "A", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 90 }, // on-time closes 11:30
    { label: "B", time: "11:00", opensBeforeMins: 30, onTimeAfterMins: 15 }, // opens 10:30 — before A's on-time close
  ],
};
const overlapResult = validateRuleSetConfig(overlapping);
assert(!overlapResult.ok, "overlapping slots are rejected");
if (!overlapResult.ok) assert(overlapResult.error.length > 0, "rejection includes a clear message: " + overlapResult.error);

console.log("\n[4] Two slots at the same time are rejected");
const sameTime: RuleSetConfig = {
  ...base,
  slots: [
    { label: "A", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 15 },
    { label: "B", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 15 },
  ],
};
assert(!validateRuleSetConfig(sameTime).ok, "same-time slots are rejected");

console.log("\n[5] Slots entered out of chronological order are still validated correctly (sorted internally)");
const outOfOrder: RuleSetConfig = {
  ...base,
  slots: [
    { label: "Afternoon", time: "14:30", opensBeforeMins: 30, onTimeAfterMins: 15 },
    { label: "Morning", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 15 },
  ],
};
assert(validateRuleSetConfig(outOfOrder).ok, "out-of-order entry is still valid (no false overlap)");

console.log("\n[6] Working weekdays and cap percent bounds");
assert(!validateRuleSetConfig({ ...base, workingWeekdays: [] }).ok, "empty working weekdays rejected");
assert(!validateRuleSetConfig({ ...base, capPercent: 101 }).ok, "cap over 100% rejected");
assert(!validateRuleSetConfig({ ...base, capPercent: -1 }).ok, "negative cap rejected");
assert(validateRuleSetConfig({ ...base, capPercent: 0 }).ok, "0% cap is valid");
assert(validateRuleSetConfig({ ...base, capPercent: 100 }).ok, "100% cap is valid");

console.log("\n[7] DIRECT WhatsApp mode requires a valid admin number");
assert(!validateRuleSetConfig({ ...base, whatsappMode: "DIRECT", adminWhatsappNumber: null }).ok, "missing number rejected");
assert(!validateRuleSetConfig({ ...base, whatsappMode: "DIRECT", adminWhatsappNumber: "+234803..." }).ok, "non-digit number rejected");
assert(validateRuleSetConfig({ ...base, whatsappMode: "DIRECT", adminWhatsappNumber: "2348031234567" }).ok, "valid international-format number accepted");
assert(validateRuleSetConfig({ ...base, whatsappMode: "GROUP", adminWhatsappNumber: null }).ok, "GROUP mode doesn't need a number");

console.log("\n[8] Worked example from the spec: warnings=2, tiers 1-3 ₦1000 / 4-6 ₦2000 / 7+ ₦4000");
const worked: RuleSetConfig = {
  ...base,
  deductionsEnabled: true,
  warningAllowance: { ...base.warningAllowance, MISSED_SUBMISSION: 2 },
  tierLadders: {
    [DEFAULT_GRADE_KEY]: {
      LATE_CLOCK_IN: [],
      LATE_SUBMISSION: [],
      FALSE_SUBMISSION: [{ fromCount: 1, toCount: null, amountKobo: 500000 }],
      MISSED_SUBMISSION: [
        { fromCount: 1, toCount: 3, amountKobo: 100000 }, // ₦1,000 = 100,000 kobo
        { fromCount: 4, toCount: 6, amountKobo: 200000 },
        { fromCount: 7, toCount: null, amountKobo: 400000 },
      ],
    },
  },
};
assert(validateRuleSetConfig(worked).ok, "worked-example tier ladder is valid");

console.log("\n[9] Gaps and overlaps in tier ladders are rejected");
const gap: RuleSetConfig = {
  ...worked,
  tierLadders: {
    [DEFAULT_GRADE_KEY]: {
      ...worked.tierLadders[DEFAULT_GRADE_KEY],
      MISSED_SUBMISSION: [
        { fromCount: 1, toCount: 3, amountKobo: 100000 },
        { fromCount: 5, toCount: null, amountKobo: 400000 }, // gap: skips 4
      ],
    },
  },
};
assert(!validateRuleSetConfig(gap).ok, "a gap between tiers is rejected");

const overlapTiers: RuleSetConfig = {
  ...worked,
  tierLadders: {
    [DEFAULT_GRADE_KEY]: {
      ...worked.tierLadders[DEFAULT_GRADE_KEY],
      MISSED_SUBMISSION: [
        { fromCount: 1, toCount: 3, amountKobo: 100000 },
        { fromCount: 3, toCount: null, amountKobo: 400000 }, // overlaps at 3
      ],
    },
  },
};
assert(!validateRuleSetConfig(overlapTiers).ok, "overlapping tiers are rejected");

const notStartingAt1: RuleSetConfig = {
  ...worked,
  tierLadders: {
    [DEFAULT_GRADE_KEY]: {
      ...worked.tierLadders[DEFAULT_GRADE_KEY],
      MISSED_SUBMISSION: [{ fromCount: 2, toCount: null, amountKobo: 100000 }],
    },
  },
};
assert(!validateRuleSetConfig(notStartingAt1).ok, "a ladder not starting at 1 is rejected");

console.log("\n[10] Empty tier ladder is always valid (means that offence type never costs anything)");
const emptyLadderOff: RuleSetConfig = { ...base, deductionsEnabled: false };
assert(validateRuleSetConfig(emptyLadderOff).ok, "empty ladders are fine while deductions are off");
const emptyLadderOn: RuleSetConfig = { ...base, deductionsEnabled: true };
assert(validateRuleSetConfig(emptyLadderOn).ok, "empty ladders are also fine with deductions on — admin can configure types incrementally");

console.log("\n[11] BY_GRADE requires grades and a ladder per grade");
const byGradeNoGrades: RuleSetConfig = { ...base, amountsApply: "BY_GRADE", grades: [] };
assert(!validateRuleSetConfig(byGradeNoGrades).ok, "BY_GRADE with no grades is rejected");

const byGrade: RuleSetConfig = {
  ...base,
  amountsApply: "BY_GRADE",
  grades: ["Junior", "Senior"],
  tierLadders: {
    Junior: { LATE_CLOCK_IN: [], LATE_SUBMISSION: [], MISSED_SUBMISSION: [], FALSE_SUBMISSION: [] },
    Senior: { LATE_CLOCK_IN: [], LATE_SUBMISSION: [], MISSED_SUBMISSION: [], FALSE_SUBMISSION: [] },
  },
};
assert(validateRuleSetConfig(byGrade).ok, "BY_GRADE with a ladder per grade (deductions off) is valid");

console.log("\nALL CHECKS PASSED");
