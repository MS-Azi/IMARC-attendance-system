import { NextRequest, NextResponse } from "next/server";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { runSlotReminders, runWarningNotices } from "@/lib/worklog/notifications";
import { prisma } from "@/lib/db";

/**
 * Triggered every 5 minutes by an external scheduler (cron-job.org — this Render plan
 * is Free, no built-in Cron Job resource). Protected by CRON_SECRET, same pattern as
 * /api/reports/monthly. Idempotent (NotificationLog dedupeKey), so an overlapping or
 * retried run — including one that wakes a sleeping Free-tier instance mid-run — can't
 * double-send anything; it just re-checks and finds nothing new to do.
 */
const RUN_BUDGET_MS = 20000;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isWorklogEnabled()) {
    return NextResponse.json({ ok: true, skipped: "worklog disabled" });
  }
  const settings = await prisma.worklogSettings.findUnique({ where: { id: 1 } });
  if (!settings?.startDate) {
    return NextResponse.json({ ok: true, skipped: "worklog start date not configured" });
  }

  const startedAt = Date.now();
  const deadline = startedAt + RUN_BUDGET_MS;
  console.log(`[cron/worklog] run started at ${new Date(startedAt).toISOString()}`);

  try {
    const now = new Date();
    const reminders = await runSlotReminders(now, deadline);
    const warnings = await runWarningNotices(now, deadline);

    const durationMs = Date.now() - startedAt;
    console.log(`[cron/worklog] run finished in ${durationMs}ms`, { ...reminders, ...warnings });
    return NextResponse.json({ ok: true, durationMs, ...reminders, ...warnings });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error(`[cron/worklog] run failed after ${durationMs}ms`, err);
    return NextResponse.json({ ok: false, durationMs, error: String(err) }, { status: 500 });
  }
}
