import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const body = await req.json();
  const data: any = { overridden: true };
  if (body.clockIn) data.clockIn = new Date(body.clockIn);
  if (body.clockOut) data.clockOut = new Date(body.clockOut);
  if (body.status) data.status = body.status;
  if (body.note !== undefined) data.note = body.note;

  const record = await prisma.attendance.update({ where: { id: params.id }, data });
  return NextResponse.json({ record });
}
