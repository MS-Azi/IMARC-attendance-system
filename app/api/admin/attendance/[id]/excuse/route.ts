import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { excuseAttendanceLate, undoAttendanceExcuse } from "@/lib/worklog/review";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { reason } = await req.json();
  try {
    const review = await excuseAttendanceLate(params.id, reason, session.sub);
    return NextResponse.json({ review });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not excuse." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const undone = await undoAttendanceExcuse(params.id, session.sub);
  return NextResponse.json({ undone: !!undone });
}
