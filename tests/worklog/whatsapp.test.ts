/**
 * Run with: npx ts-node --compiler-options {\"module\":\"CommonJS\"} tests/worklog/whatsapp.test.ts
 */
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../../lib/worklog/whatsapp";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok - " + msg);
}

console.log("\n[1] Message format matches the spec's exact example");
const msg = buildWhatsAppMessage("10AM", "Chidi", "Sent revised floor plans for Pearl");
assert(msg === "[10AM UPDATE] Chidi — Sent revised floor plans for Pearl", "got: " + msg);

console.log("\n[2] Message with a link appended");
const msgWithLink = buildWhatsAppMessage("10AM", "Chidi", "Sent revised floor plans", "https://drive.google.com/x");
assert(msgWithLink === "[10AM UPDATE] Chidi — Sent revised floor plans — https://drive.google.com/x", "got: " + msgWithLink);

console.log("\n[3] DIRECT mode URL");
const directUrl = buildWhatsAppUrl({ whatsappMode: "DIRECT", adminWhatsappNumber: "2348031234567" }, msg);
assert(directUrl.startsWith("https://wa.me/2348031234567?text="), "got: " + directUrl);
assert(decodeURIComponent(directUrl.split("text=")[1]) === msg, "message round-trips through URL encoding");

console.log("\n[4] GROUP mode URL (no number in the link)");
const groupUrl = buildWhatsAppUrl({ whatsappMode: "GROUP", adminWhatsappNumber: null }, msg);
assert(groupUrl.startsWith("https://wa.me/?text="), "got: " + groupUrl);
assert(decodeURIComponent(groupUrl.split("text=")[1]) === msg, "message round-trips through URL encoding");

console.log("\n[5] DIRECT mode with no number configured falls back to the GROUP-style link rather than a broken URL");
const fallbackUrl = buildWhatsAppUrl({ whatsappMode: "DIRECT", adminWhatsappNumber: null }, msg);
assert(fallbackUrl.startsWith("https://wa.me/?text="), "got: " + fallbackUrl);

console.log("\nALL CHECKS PASSED");
