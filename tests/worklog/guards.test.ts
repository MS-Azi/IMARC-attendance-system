/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/guards.test.ts
 */
import { checkSlotCreationGuards, SlotCreationGuardInput } from "../../lib/worklog/guards";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

const d = (s: string) => new Date(s + "T00:00:00.000Z");

function base(overrides: Partial<SlotCreationGuardInput> = {}): SlotCreationGuardInput {
  return {
    date: d("2026-09-27"), // a Sunday
    today: d("2026-09-27"),
    weekday: 0,
    workingWeekdays: [1, 2, 3, 4, 5],
    isNonWorkingDay: false,
    worklogStartDate: null,
    staffDateJoined: d("2026-01-01"),
    allowFuture: false,
    ...overrides,
  };
}

console.log("\n[1] A normal working day, employed staff, no restrictions -> allowed");
assert(
  checkSlotCreationGuards(base({ date: d("2026-09-28"), today: d("2026-09-28"), weekday: 1 })).allowed,
  "Monday, matches workingWeekdays"
);

console.log("\n[2] Non-working weekday (Sunday) is rejected");
const r2 = checkSlotCreationGuards(base());
assert(!r2.allowed, "Sunday rejected");

console.log("\n[3] A working weekday marked as a non-working date (holiday) is rejected");
const r3 = checkSlotCreationGuards(base({ date: d("2026-09-28"), today: d("2026-09-28"), weekday: 1, isNonWorkingDay: true }));
assert(!r3.allowed, "holiday rejected even though it's a Monday");

console.log("\n[4] Before the worklog start date is rejected");
const r4 = checkSlotCreationGuards(
  base({ date: d("2026-09-28"), today: d("2026-10-05"), weekday: 1, worklogStartDate: d("2026-10-01") })
);
assert(!r4.allowed, "date before worklogStartDate rejected");

console.log("\n[5] On or after the worklog start date is allowed");
const r5 = checkSlotCreationGuards(
  base({ date: d("2026-10-01"), today: d("2026-10-05"), weekday: 4, worklogStartDate: d("2026-10-01") })
);
assert(r5.allowed, "date exactly on worklogStartDate is allowed (inclusive)");

console.log("\n[6] Before this staff member's own start date is rejected");
const r6 = checkSlotCreationGuards(
  base({ date: d("2026-09-28"), today: d("2026-09-28"), weekday: 1, staffDateJoined: d("2026-10-01") })
);
assert(!r6.allowed, "staff joined after this date -> rejected");

console.log("\n[7] Future dates rejected when allowFuture is false (board/cron)");
const r7 = checkSlotCreationGuards(base({ date: d("2026-10-05"), today: d("2026-09-28"), weekday: 1 }));
assert(!r7.allowed, "future date rejected for board/cron");

console.log("\n[8] Future dates allowed when allowFuture is true (bulk-excuse for planned leave)");
const r8 = checkSlotCreationGuards(base({ date: d("2026-10-05"), today: d("2026-09-28"), weekday: 1, allowFuture: true }));
assert(r8.allowed, "future date allowed for bulk-excuse");

console.log("\n[9] Today itself is never treated as 'future' (boundary is inclusive)");
const r9 = checkSlotCreationGuards(base({ date: d("2026-09-28"), today: d("2026-09-28"), weekday: 1 }));
assert(r9.allowed, "today is allowed even with allowFuture: false");

console.log("\nALL CHECKS PASSED");
