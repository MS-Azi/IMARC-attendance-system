import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildMonthlySummary, summaryToHtml } from "@/lib/report";
import { buildAttendanceWorkbook, AttendanceRow } from "@/lib/excel";
import { sendReportEmail } from "@/lib/mailer";
import { getSettings } from "@/lib/attendance";

/**
 * Triggered by a Render Cron Job on the 1st of each month.
 * Protected by CRON_SECRET so only the scheduled job (or admin) can call it.
 * Generates the previous month's summary, emails it with an Excel attachment,
 * and stores the summary for later re-download.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prevMonthDate.getUTCFullYear();
  const month = prevMonthDate.getUTCMonth() + 1;

  const summary = await buildMonthlySummary(year, month);
  const settings = await getSettings();

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const records = await prisma.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: { staff: true },
    orderBy: [{ date: "asc" }],
  });
  const rows: AttendanceRow[] = records.map((r) => ({
    staffName: r.staff.fullName,
    position: r.staff.position,
    department: r.staff.department,
    date: r.date.toISOString().slice(0, 10),
    clockIn: r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    clockOut: r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    status: r.status,
    inFlagged: r.deviceStatus === "MISMATCH",
    outFlagged: r.clockOutDeviceStatus === "MISMATCH",
  }));
  const buffer = await buildAttendanceWorkbook(rows, summary.periodLabel);

  await sendReportEmail({
    to: settings.reportEmail,
    subject: `iMarc Attendance — Monthly Report (${summary.periodLabel})`,
    html: summaryToHtml(summary),
    attachmentBuffer: buffer as unknown as Buffer,
    attachmentName: `attendance-report-${summary.periodLabel}.xlsx`,
  });

  await prisma.monthlyReport.create({
    data: {
      periodLabel: summary.periodLabel,
      emailedTo: settings.reportEmail,
      summaryJson: JSON.stringify(summary),
    },
  });

  return NextResponse.json({ ok: true, periodLabel: summary.periodLabel });
}
