import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

// A staff member's very first device bind is expected (everyone gets UNVERIFIED once).
// Only surface it if it happens again for the same staff member, which is the real signal.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const flagged = await prisma.attendance.findMany({
    where: { deviceStatus: { in: ["MISMATCH", "UNVERIFIED"] } },
    include: { staff: true },
    orderBy: { date: "desc" },
  });

  const unverifiedCounts = new Map<string, number>();
  for (const r of flagged) {
    if (r.deviceStatus === "UNVERIFIED") {
      unverifiedCounts.set(r.staffId, (unverifiedCounts.get(r.staffId) || 0) + 1);
    }
  }

  const records = flagged.filter(
    (r) => r.deviceStatus === "MISMATCH" || (unverifiedCounts.get(r.staffId) || 0) > 1
  );

  return NextResponse.json({ records });
}
