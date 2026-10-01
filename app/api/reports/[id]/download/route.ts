import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildAttendanceWorkbook, AttendanceRow } from "@/lib/excel";

/** Regenerates the Excel workbook for a stored monthly report from live Attendance
 * records (the workbook itself was never persisted, only the summary stats) — lets an
 * admin get the same file that would have been emailed, since SMTP doesn't work on
 * Render's free tier. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const report = await prisma.monthlyReport.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const [year, month] = report.periodLabel.split("-").map(Number);
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
  const buffer = await buildAttendanceWorkbook(rows, report.periodLabel);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-report-${report.periodLabel}.xlsx"`,
    },
  });
}
