import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const day = await prisma.nonWorkingDay.findUnique({ where: { id: params.id } });
  if (!day) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.nonWorkingDay.delete({ where: { id: params.id } });
  await writeAuditLog({
    actorType: "ADMIN",
    actorId: session.sub,
    action: "worklog_non_working_day.delete",
    entityType: "NonWorkingDay",
    entityId: day.id,
    before: { date: day.date, reason: day.reason },
  });
  return NextResponse.json({ ok: true });
}
