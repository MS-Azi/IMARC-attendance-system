/**
 * Regression guard: clock-in must NEVER be gated by worklog rules acknowledgement,
 * even when a staff member genuinely has unacknowledged rules waiting. This can't be
 * a pure unit test — it has to prove the real request path (clock-in API + worklog
 * rules API) has no dependency wired between them, which only a live run can show.
 *
 * Requires: the dev server running locally (npm run dev) with WORKLOG_ENABLED=true,
 * and .env pointed at a database (creates/deletes disposable test rows only).
 *
 * Run with: node tests/worklog/clock-in-not-blocked.test.mjs
 * (from the project root, so it resolves node_modules — or copy it there temporarily)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const PASSWORD = "zzTestPass123!";

let adminId, staffId;

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

async function login(loginId, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error("login failed: " + JSON.stringify(body));
  return res.headers.get("set-cookie").split(";")[0];
}

async function main() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error("No Settings row found.");

  const admin = await prisma.admin.create({
    data: { email: "zz-failopen-admin@example.test", passwordHash: await bcrypt.hash(PASSWORD, 10) },
  });
  adminId = admin.id;
  const adminCookie = await login("zz-failopen-admin@example.test", PASSWORD);

  const staff = await prisma.staff.create({
    data: { fullName: "ZZ FailOpen Test (delete me)", loginId: "zz-failopen-staff@example.test", passwordHash: await bcrypt.hash(PASSWORD, 10), position: "Test" },
  });
  staffId = staff.id;
  const staffCookie = await login("zz-failopen-staff@example.test", PASSWORD);

  console.log("\n[1] Publish a rule set the staff member has NOT acknowledged");
  const publishRes = await fetch(`${BASE}/api/admin/worklog/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      config: {
        slots: [{ label: "10AM", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 15 }],
        lastSlotLateCloseTime: "17:45",
        workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
        reminderMinsBefore: 15,
        emailOnLate: true,
        whatsappMode: "GROUP",
        adminWhatsappNumber: null,
        deductionsEnabled: false,
        warningAllowance: { LATE_CLOCK_IN: 0, LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 },
        amountsApply: "SAME_FOR_ALL",
        grades: [],
        tierLadders: { __ALL__: { LATE_CLOCK_IN: [], LATE_SUBMISSION: [], MISSED_SUBMISSION: [], FALSE_SUBMISSION: [] } },
        capPercent: 10,
        staffCanSeeAmounts: false,
      },
      appliedImmediately: true,
      overrideReason: "clock-in-not-blocked regression test",
    }),
  });
  assert(publishRes.status === 200, "rule set published, got " + publishRes.status);

  console.log("\n[2] Confirm the staff member genuinely has NOT acknowledged it");
  const currentRes = await fetch(`${BASE}/api/worklog/rules/current`, { headers: { cookie: staffCookie } });
  const currentData = await currentRes.json();
  assert(currentData.acknowledged === false, "acknowledged is false, got " + currentData.acknowledged);

  console.log("\n[3] Clock-in still succeeds despite unacknowledged rules");
  const clockRes = await fetch(`${BASE}/api/clock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: staffCookie },
    body: JSON.stringify({ action: "IN", lat: settings.officeLat, lng: settings.officeLng, deviceId: "failopen-test-device" }),
  });
  const clockData = await clockRes.json();
  assert(clockRes.status === 200, "clock-in succeeded (unblocked by acknowledgement state), got " + clockRes.status);
  assert(!!clockData.record.clockIn, "clockIn timestamp was recorded");

  console.log("\n[4] Acknowledgement state is still untouched by clocking in (no side effect either way)");
  const currentRes2 = await fetch(`${BASE}/api/worklog/rules/current`, { headers: { cookie: staffCookie } });
  const currentData2 = await currentRes2.json();
  assert(currentData2.acknowledged === false, "still unacknowledged after clocking in, got " + currentData2.acknowledged);

  console.log("\nALL CHECKS PASSED");
}

main()
  .catch((err) => {
    console.error("\nTEST FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("\nCleaning up disposable test data...");
    try {
      if (staffId) {
        await prisma.attendance.deleteMany({ where: { staffId } });
        await prisma.ruleAcknowledgement.deleteMany({ where: { staffId } });
        await prisma.staff.delete({ where: { id: staffId } }).catch(() => {});
      }
      if (adminId) {
        await prisma.worklogRuleSet.deleteMany({ where: { createdById: adminId } });
        await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
        await prisma.admin.delete({ where: { id: adminId } }).catch(() => {});
      }
      console.log("Cleanup done.");
    } catch (e) {
      console.error("Cleanup error (may need manual cleanup):", e.message);
    }
    await prisma.$disconnect();
  });
