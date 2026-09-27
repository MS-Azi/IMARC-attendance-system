import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { lagosDateKey } from "@/lib/worklog/lagos";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

// Salary/grade are admin-only, never returned by any staff-facing route.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const history = await prisma.staffCompensation.findMany({
    where: { staffId: params.id },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json({ history });
}

// Compensation is never edited in place — this always creates a new history row.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const staff = await prisma.staff.findUnique({ where: { id: params.id } });
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  const { monthlySalaryKobo, grade, effectiveFrom } = await req.json();
  if (!Number.isInteger(monthlySalaryKobo) || monthlySalaryKobo < 0) {
    return NextResponse.json({ error: "Monthly salary must be a whole number of kobo, 0 or more." }, { status: 400 });
  }

  const comp = await prisma.staffCompensation.create({
    data: {
      staffId: params.id,
      monthlySalaryKobo,
      grade: grade || null,
      effectiveFrom: effectiveFrom ? lagosDateKey(new Date(effectiveFrom)) : lagosDateKey(new Date()),
      createdById: session.sub,
    },
  });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: session.sub,
    action: "staff_compensation.create",
    entityType: "StaffCompensation",
    entityId: comp.id,
    after: { staffId: params.id, monthlySalaryKobo, grade: comp.grade, effectiveFrom: comp.effectiveFrom },
  });

  return NextResponse.json({ compensation: comp });
}
