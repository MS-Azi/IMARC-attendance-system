import { NextRequest, NextResponse } from "next/server";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { runSlotReminders, runWarningNotices } from "@/lib/worklog/notifications";

/**
 * Triggered every 5 minutes by an external scheduler (cron-job.org — this Render plan
 * is Free, no built-in Cron Job resource). Protected by CRON_SECRET, same pattern as
 * /api/reports/monthly. Idempotent (NotificationLog dedupeKey), so an overlapping or
 * retried run — including one that wakes a sleeping Free-tier instance mid-run — can't
 * double-send anything; it just re-checks and finds nothing new to do.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isWorklogEnabled()) {
    return NextResponse.json({ ok: true, skipped: "worklog disabled" });
  }

  const now = new Date();
  const reminders = await runSlotReminders(now);
  const warnings = await runWarningNotices(now);

  return NextResponse.json({ ok: true, ...reminders, ...warnings });
}
