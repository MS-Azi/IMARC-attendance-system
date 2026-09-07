import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/attendance";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  for (const k of ["officeLat", "officeLng", "radiusMeters", "lateThreshold", "reportEmail"]) {
    if (k in body) data[k] = body[k];
  }
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, officeLat: 0, officeLng: 0, ...data },
    update: data,
  });
  return NextResponse.json({ settings });
}
