import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { reviewSlot } from "@/lib/worklog/review";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { action, reason } = await req.json();
  if (!["FALSE", "EXCUSE", "UNDO"].includes(action)) {
    return NextResponse.json({ error: "action must be FALSE, EXCUSE, or UNDO." }, { status: 400 });
  }

  try {
    const record = await reviewSlot(params.id, action, reason, session.sub);
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not review slot." }, { status: 400 });
  }
}
