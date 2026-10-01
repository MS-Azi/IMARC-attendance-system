import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const last = await prisma.auditLog.findFirst({
    where: { entityType: "Backup", action: "data_backup.download" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ lastBackupAt: last?.createdAt ?? null });
}
