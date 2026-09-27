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

export async function GET() {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const settings = await prisma.worklogSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({ startDate: settings?.startDate ?? null });
}

export async function POST(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { startDate } = await req.json();
  const value = startDate ? lagosDateKey(new Date(startDate)) : null;

  await prisma.worklogSettings.upsert({
    where: { id: 1 },
    update: { startDate: value },
    create: { id: 1, startDate: value },
  });

  await writeAuditLog({
    actorType: "ADMIN",
    actorId: session.sub,
    action: "worklog_settings.set_start_date",
    entityType: "WorklogSettings",
    entityId: "1",
    after: { startDate: value },
  });

  return NextResponse.json({ startDate: value });
}
