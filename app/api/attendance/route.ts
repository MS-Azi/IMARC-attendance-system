import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staffId");
  const status = searchParams.get("status");

  const where: any = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  if (staffId) where.staffId = staffId;
  if (status) where.status = status;

  const records = await prisma.attendance.findMany({
    where,
    include: { staff: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ records });
}
