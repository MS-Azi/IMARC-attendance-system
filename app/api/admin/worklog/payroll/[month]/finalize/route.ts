import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { computeMonthPayroll } from "@/lib/worklog/payrollCompute";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(_req: NextRequest, { params }: { params: { month: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const [year, month] = params.month.split("-").map(Number);
  if (!year || !month) return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  const monthEnd = new Date(Date.UTC(year, month, 1));
  if (new Date() < monthEnd) {
    return NextResponse.json({ error: "Can't finalize a month that hasn't ended yet." }, { status: 400 });
  }

  const existing = await prisma.payrollMonth.findUnique({ where: { month: params.month } });
  if (existing?.finalizedAt) {
    return NextResponse.json({ error: "This month is already finalized." }, { status: 409 });
  }

  const lines = await computeMonthPayroll(params.month);

  const payrollMonth = await prisma.payrollMonth.upsert({
    where: { month: params.month },
    update: { finalizedAt: new Date(), finalizedById: session.sub },
    create: { month: params.month, finalizedAt: new Date(), finalizedById: session.sub },
  });

  await prisma.payrollLine.deleteMany({ where: { payrollMonthId: payrollMonth.id } });
  await prisma.payrollLine.createMany({
    data: lines.map((l) => ({
      payrollMonthId: payrollMonth.id,
      staffId: l.staffId,
      baseKobo: l.baseKobo,
      breakdown: l.breakdown as any,
      totalBeforeCapKobo: l.breakdown.totalBeforeCapKobo,
      capKobo: l.breakdown.capKobo,
      totalDeductionKobo: l.breakdown.totalDeductionKobo,
      capped: l.breakdown.capped,
      netKobo: l.breakdown.netKobo,
      deductionsEnabled: l.deductionsEnabled,
    })),
  });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: session.sub,
    action: "worklog_payroll.finalize",
    entityType: "PayrollMonth",
    entityId: payrollMonth.id,
    after: { month: params.month, staffCount: lines.length },
  });

  return NextResponse.json({ ok: true, month: params.month, staffCount: lines.length });
}
