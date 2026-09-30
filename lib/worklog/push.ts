import webpush from "web-push";
import { prisma } from "@/lib/db";
import { withTimeout } from "./timeout";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not set.");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

/** Sends a push to every subscription a staff member has. Removes subscriptions the
 * push service reports as gone (404/410) rather than retrying them forever. Never
 * throws — a push failure must not break the cron run for other staff/slots. */
export async function sendPushToStaff(staffId: string, payload: { title: string; body: string; url?: string }) {
  ensureConfigured();
  const subs = await prisma.pushSubscription.findMany({ where: { staffId } });
  let sent = 0;
  for (const sub of subs) {
    try {
      await withTimeout(
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        ),
        5000,
        "push"
      );
      await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date() } });
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
      // else: transient failure, leave the subscription in place for next time.
    }
  }
  return sent;
}
