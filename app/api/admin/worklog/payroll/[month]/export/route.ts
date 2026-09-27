import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { computeMonthPayroll, StaffPayrollLine } from "@/lib/worklog/payrollCompute";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function naira(kobo: number) {
  return (kobo / 100).toFixed(2);
}

function toCsv(lines: StaffPayrollLine[]): string {
  const header = [
    "Staff",
    "Base (NGN)",
    "Late Clock-in",
    "Late Submission",
    "Missed Submission",
    "False Submission",
    "Total Before Cap (NGN)",
    "Cap (NGN)",
    "Total Deduction (NGN)",
    "Capped",
    "Net (NGN)",
    "Deductions Enabled",
  ];
  const rows = lines.map((l) =>
    [
      l.staffName,
      naira(l.baseKobo),
      naira(l.breakdown.subtotals.LATE_CLOCK_IN),
      naira(l.breakdown.subtotals.LATE_SUBMISSION),
      naira(l.breakdown.subtotals.MISSED_SUBMISSION),
      naira(l.breakdown.subtotals.FALSE_SUBMISSION),
      naira(l.breakdown.totalBeforeCapKobo),
      naira(l.breakdown.capKobo),
      naira(l.breakdown.totalDeductionKobo),
      l.breakdown.capped ? "YES" : "NO",
      naira(l.breakdown.netKobo),
      l.deductionsEnabled ? "YES" : "NO",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...rows].join("\r\n");
}

export async function GET(_req: NextRequest, { params }: { params: { month: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const finalized = await prisma.payrollMonth.findUnique({
    where: { month: params.month },
    include: { lines: { include: { staff: true } } },
  });

  const lines: StaffPayrollLine[] = finalized?.finalizedAt
    ? finalized.lines.map((l) => ({
        staffId: l.staffId,
        staffName: l.staff.fullName,
        baseKobo: l.baseKobo,
        deductionsEnabled: l.deductionsEnabled,
        breakdown: l.breakdown as any,
      }))
    : await computeMonthPayroll(params.month);

  const csv = toCsv(lines);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="worklog-payroll-${params.month}.csv"`,
    },
  });
}
