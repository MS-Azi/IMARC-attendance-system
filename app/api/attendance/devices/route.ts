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
    where: {
      OR: [{ deviceStatus: { in: ["MISMATCH", "UNVERIFIED"] } }, { clockOutDeviceStatus: "MISMATCH" }],
    },
    include: { staff: { select: { fullName: true, department: true, boundDeviceId: true } } },
    orderBy: { date: "desc" },
  });

  const unverifiedCounts = new Map<string, number>();
  for (const r of flagged) {
    if (r.deviceStatus === "UNVERIFIED") {
      unverifiedCounts.set(r.staffId, (unverifiedCounts.get(r.staffId) || 0) + 1);
    }
  }

  // Description of each flagged staff member's bound device, taken from the newest
  // check-in/out made on it that recorded one (descriptions exist only from this release on).
  const boundDescriptions = new Map<string, string | null>();
  for (const r of flagged) {
    const bound = r.staff.boundDeviceId;
    if (boundDescriptions.has(r.staffId)) continue;
    if (!bound) {
      boundDescriptions.set(r.staffId, null);
      continue;
    }
    const [inRec, outRec] = await Promise.all([
      prisma.attendance.findFirst({
        where: { staffId: r.staffId, deviceId: bound, clockInUserAgent: { not: null } },
        orderBy: { clockIn: "desc" },
        select: { clockIn: true, clockInUserAgent: true },
      }),
      prisma.attendance.findFirst({
        where: { staffId: r.staffId, clockOutDeviceId: bound, clockOutUserAgent: { not: null } },
        orderBy: { clockOut: "desc" },
        select: { clockOut: true, clockOutUserAgent: true },
      }),
    ]);
    const useOut = outRec && (!inRec || (outRec.clockOut?.getTime() ?? 0) > (inRec.clockIn?.getTime() ?? 0));
    boundDescriptions.set(r.staffId, useOut ? outRec.clockOutUserAgent : inRec?.clockInUserAgent ?? null);
  }

  const records = flagged
    .filter((r) => {
      const inFlagged = r.deviceStatus === "MISMATCH" || (unverifiedCounts.get(r.staffId) || 0) > 1;
      const outFlagged = r.clockOutDeviceStatus === "MISMATCH";
      return inFlagged || outFlagged;
    })
    .map((r) => {
      const flaggedActions: ("IN" | "OUT")[] = [];
      if (r.deviceStatus === "MISMATCH" || (unverifiedCounts.get(r.staffId) || 0) > 1) flaggedActions.push("IN");
      if (r.clockOutDeviceStatus === "MISMATCH") flaggedActions.push("OUT");
      const { boundDeviceId: _bound, ...staff } = r.staff;
      return { ...r, staff, flaggedActions, boundDeviceUserAgent: boundDescriptions.get(r.staffId) ?? null };
    });

  return NextResponse.json({ records });
}
