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

  const days = await prisma.nonWorkingDay.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ days });
}

export async function POST(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { date, reason } = await req.json();
  if (!date || !reason?.trim()) {
    return NextResponse.json({ error: "A date and reason are required." }, { status: 400 });
  }

  try {
    const day = await prisma.nonWorkingDay.create({
      data: { date: lagosDateKey(new Date(date)), reason: reason.trim(), createdById: session.sub },
    });
    await writeAuditLog({
      actorType: "ADMIN",
      actorId: session.sub,
      action: "worklog_non_working_day.create",
      entityType: "NonWorkingDay",
      entityId: day.id,
      after: { date: day.date, reason: day.reason },
    });
    return NextResponse.json({ day });
  } catch {
    return NextResponse.json({ error: "That date is already marked non-working." }, { status: 409 });
  }
}
