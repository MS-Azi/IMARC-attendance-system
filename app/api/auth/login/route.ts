import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { loginId, password } = await req.json();
  if (!loginId || !password) {
    return NextResponse.json({ error: "Enter your login ID and password." }, { status: 400 });
  }

  // Try admin first, then staff.
  const admin = await prisma.admin.findUnique({ where: { email: loginId } });
  if (admin && (await verifyPassword(password, admin.passwordHash))) {
    await createSession({ sub: admin.id, role: "ADMIN", name: admin.email });
    return NextResponse.json({ role: "ADMIN" });
  }

  const staff = await prisma.staff.findUnique({ where: { loginId } });
  if (staff && staff.active && (await verifyPassword(password, staff.passwordHash))) {
    await createSession({ sub: staff.id, role: "STAFF", name: staff.fullName });
    return NextResponse.json({ role: "STAFF" });
  }

  return NextResponse.json({ error: "Incorrect login ID or password." }, { status: 401 });
}
