import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const attendance = await prisma.attendance.findUnique({ where: { id: params.id } });
  if (!attendance) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  if (!attendance.deviceId) {
    return NextResponse.json({ error: "This record has no device to approve." }, { status: 400 });
  }

  await prisma.staff.update({
    where: { id: attendance.staffId },
    data: { boundDeviceId: attendance.deviceId, deviceBoundAt: new Date() },
  });

  const record = await prisma.attendance.update({
    where: { id: attendance.id },
    data: { deviceStatus: "MATCHED" },
  });

  return NextResponse.json({ record });
}
