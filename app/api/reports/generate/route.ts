import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateAndStoreMonthlyReport } from "@/lib/report";

/** On-demand generation of any past month's report from the admin Reports page —
 * overwrites that period's report if one already exists (same as the cron run would). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { year, month } = await req.json();
  const now = new Date();
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    new Date(Date.UTC(year, month - 1, 1)) > now
  ) {
    return NextResponse.json({ error: "Invalid or future year/month." }, { status: 400 });
  }

  const report = await generateAndStoreMonthlyReport(year, month, session.name);
  return NextResponse.json({ report });
}
