import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const staff = await prisma.staff.findMany({ orderBy: { fullName: "asc" } });
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const body = await req.json();
  const { fullName, loginId, password, position, staffCode, department, dateJoined } = body;

  if (!fullName || !loginId || !password || !position) {
    return NextResponse.json({ error: "Name, login ID, password, and position are required." }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({ where: { loginId } });
  if (existing) {
    return NextResponse.json({ error: "That login ID is already in use." }, { status: 409 });
  }

  const staff = await prisma.staff.create({
    data: {
      fullName,
      loginId,
      passwordHash: await hashPassword(password),
      position,
      staffCode: staffCode || undefined,
      department: department || undefined,
      dateJoined: dateJoined ? new Date(dateJoined) : new Date(),
    },
  });
  return NextResponse.json({ staff });
}
