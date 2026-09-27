import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { computeMonthPayroll } from "@/lib/worklog/payrollCompute";
import { lagosMonthStr } from "@/lib/worklog/lagos";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month") || lagosMonthStr(new Date());
  const finalized = await prisma.payrollMonth.findUnique({ where: { month }, include: { lines: { include: { staff: true } } } });

  if (finalized?.finalizedAt) {
    return NextResponse.json({
      month,
      finalized: true,
      finalizedAt: finalized.finalizedAt,
      lines: finalized.lines.map((l) => ({
        staffId: l.staffId,
        staffName: l.staff.fullName,
        baseKobo: l.baseKobo,
        breakdown: l.breakdown,
      })),
    });
  }

  const lines = await computeMonthPayroll(month);
  return NextResponse.json({ month, finalized: false, finalizedAt: null, lines });
}
