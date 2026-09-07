import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const reports = await prisma.monthlyReport.findMany({ orderBy: { generatedAt: "desc" } });
  return NextResponse.json({ reports });
}
