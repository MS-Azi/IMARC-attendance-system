/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/attendance/clock.test.ts
 */
import { resolveClockLocation } from "../../lib/clockGuard";
import { compareDeviceBinding } from "../../lib/attendance";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

const OFFICE = { officeLat: 6.5244, officeLng: 3.3792, radiusMeters: 100 };
// ~11km away — well outside any reasonable office radius.
const FAR_AWAY = { lat: 6.6, lng: 3.5 };
const AT_OFFICE = { lat: 6.5244, lng: 3.3792 };

console.log("\n[1] Office staff inside the geofence is allowed");
const r1 = resolveClockLocation({ workMode: "OFFICE", lat: AT_OFFICE.lat, lng: AT_OFFICE.lng, ...OFFICE });
assert(r1.allowed, "allowed");
if (r1.allowed) assert(r1.locationShared, "location recorded as shared");

console.log("\n[2] Office staff OUTSIDE the geofence is still blocked (unchanged behavior)");
const r2 = resolveClockLocation({ workMode: "OFFICE", lat: FAR_AWAY.lat, lng: FAR_AWAY.lng, ...OFFICE });
assert(!r2.allowed, "blocked");
if (!r2.allowed) assert(r2.status === 403, "403, same as before REMOTE existed");

console.log("\n[3] Office staff with no location at all is still blocked (unchanged behavior)");
const r3 = resolveClockLocation({ workMode: "OFFICE", lat: null, lng: null, ...OFFICE });
assert(!r3.allowed, "blocked");
if (!r3.allowed) assert(r3.status === 400, "400, same as before REMOTE existed");

console.log("\n[4] Remote staff OUTSIDE the geofence is allowed — only the geofence is skipped");
const r4 = resolveClockLocation({ workMode: "REMOTE", lat: FAR_AWAY.lat, lng: FAR_AWAY.lng, ...OFFICE });
assert(r4.allowed, "allowed despite being far from the office");
if (r4.allowed) assert(r4.locationShared, "location still recorded since it was available");

console.log("\n[5] Remote staff with no location available is still allowed, marked not shared");
const r5 = resolveClockLocation({ workMode: "REMOTE", lat: null, lng: null, ...OFFICE });
assert(r5.allowed, "allowed even with no GPS");
if (r5.allowed) assert(!r5.locationShared, "locationShared is false");

console.log("\n[6] Device binding: unrecognised device is flagged MISMATCH the same way for remote and office staff");
// compareDeviceBinding takes no work-mode parameter at all — it's unaffected by it,
// which is what makes "device binding still applies exactly as for office staff" true.
assert(compareDeviceBinding("device-A", "device-B") === "MISMATCH", "bound device A, incoming device B -> MISMATCH");
assert(compareDeviceBinding("device-A", "device-A") === "MATCHED", "same device -> MATCHED");
assert(compareDeviceBinding(null, "device-A") === "UNVERIFIED", "first-time binding -> UNVERIFIED");
assert(compareDeviceBinding("device-A", null) === "MATCHED", "no device id sent -> MATCHED (nothing to compare)");

console.log("\nALL CHECKS PASSED");
