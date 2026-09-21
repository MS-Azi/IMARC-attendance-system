import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildAttendanceWorkbook, AttendanceRow } from "@/lib/excel";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { staff: true },
    orderBy: [{ date: "desc" }, { staff: { fullName: "asc" } }],
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

  const buffer = await buildAttendanceWorkbook(rows, "Attendance");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-export.xlsx"`,
    },
  });
}
