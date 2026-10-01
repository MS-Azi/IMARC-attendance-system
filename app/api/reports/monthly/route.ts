import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreMonthlyReport } from "@/lib/report";

/**
 * Triggered by a Render Cron Job on the 1st of each month. Protected by CRON_SECRET
 * so only the scheduled job (or admin) can call it. Generates the previous month's
 * summary and stores it for viewing/download on the admin Reports page — no email,
 * SMTP doesn't work on Render's free tier.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const report = await generateAndStoreMonthlyReport(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, "cron");

  return NextResponse.json({ ok: true, periodLabel: report.periodLabel });
}
