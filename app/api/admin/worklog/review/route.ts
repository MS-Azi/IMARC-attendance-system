import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import { getReviewBoardForDate } from "@/lib/worklog/review";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  const board = await getReviewBoardForDate(date);
  return NextResponse.json(board);
}
