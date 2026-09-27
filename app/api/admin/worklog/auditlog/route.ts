import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWorklogEnabled } from "@/lib/worklog/flags";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!isWorklogEnabled()) return NextResponse.json({ error: "Worklog module is disabled." }, { status: 404 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const take = Math.min(Number(req.nextUrl.searchParams.get("take")) || 100, 500);
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take });

  const adminIds = [...new Set(entries.filter((e) => e.actorType === "ADMIN").map((e) => e.actorId))];
  const staffIds = [...new Set(entries.filter((e) => e.actorType === "STAFF").map((e) => e.actorId))];
  const [admins, staff] = await Promise.all([
    prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } }),
    prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } }),
  ]);
  const adminNames = new Map(admins.map((a) => [a.id, a.email]));
  const staffNames = new Map(staff.map((s) => [s.id, s.fullName]));

  const withNames = entries.map((e) => ({
    ...e,
    actorName: e.actorType === "ADMIN" ? adminNames.get(e.actorId) ?? e.actorId : staffNames.get(e.actorId) ?? e.actorId,
  }));

  return NextResponse.json({ entries: withNames });
}
