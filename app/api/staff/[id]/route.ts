import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  for (const k of ["fullName", "position", "staffCode", "department", "active"]) {
    if (k in body) data[k] = body[k];
  }
  if (body.password) data.passwordHash = await hashPassword(body.password);
  if (body.dateJoined) data.dateJoined = new Date(body.dateJoined);

  let before: { workMode: string } | null = null;
  if (body.workMode) {
    if (body.workMode !== "OFFICE" && body.workMode !== "REMOTE") {
      return NextResponse.json({ error: "Invalid work mode." }, { status: 400 });
    }
    before = await prisma.staff.findUnique({ where: { id: params.id }, select: { workMode: true } });
    data.workMode = body.workMode;
  }

  const staff = await prisma.staff.update({ where: { id: params.id }, data });

  if (before && before.workMode !== staff.workMode) {
    await writeAuditLog({
      actorType: "ADMIN",
      actorId: session.sub,
      action: "staff.set_work_mode",
      entityType: "Staff",
      entityId: staff.id,
      before: { workMode: before.workMode },
      after: { workMode: staff.workMode },
    });
  }

  return NextResponse.json({ staff });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const staff = await prisma.staff.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ staff });
}
