import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { bulkExcuseRange } from "@/lib/worklog/review";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const { from, to, reason } = await req.json();
  if (!from || !to) return NextResponse.json({ error: "from and to dates are required." }, { status: 400 });

  try {
    const days = await bulkExcuseRange(params.id, new Date(from), new Date(to), reason, session.sub);
    return NextResponse.json({ days });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not excuse range." }, { status: 400 });
  }
}
