import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  for (const k of ["fullName", "position", "staffCode", "department", "active"]) {
    if (k in body) data[k] = body[k];
  }
  if (body.password) data.passwordHash = await hashPassword(body.password);
  if (body.dateJoined) data.dateJoined = new Date(body.dateJoined);

  const staff = await prisma.staff.update({ where: { id: params.id }, data });
  return NextResponse.json({ staff });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const staff = await prisma.staff.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ staff });
}
