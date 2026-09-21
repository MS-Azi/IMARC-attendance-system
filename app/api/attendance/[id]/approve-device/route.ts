import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const attendance = await prisma.attendance.findUnique({ where: { id: params.id } });
  if (!attendance) return NextResponse.json({ error: "Record not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let side: "IN" | "OUT" | undefined = body.action === "IN" || body.action === "OUT" ? body.action : undefined;

  // A lone first-time UNVERIFIED bind isn't "flagged" (matches the Device Review queue's
  // own rule) — only a repeat UNVERIFIED for this staff member counts.
  let inFlagged = attendance.deviceStatus === "MISMATCH";
  if (!inFlagged && attendance.deviceStatus === "UNVERIFIED") {
    const unverifiedCount = await prisma.attendance.count({
      where: { staffId: attendance.staffId, deviceStatus: "UNVERIFIED" },
    });
    inFlagged = unverifiedCount > 1;
  }
  const outFlagged = attendance.clockOutDeviceStatus === "MISMATCH";

  // If both sides are flagged with different devices, we can't rebind to both at once —
  // the caller has to say which one is being approved.
  if (!side) {
    if (inFlagged && outFlagged && attendance.deviceId !== attendance.clockOutDeviceId) {
      return NextResponse.json(
        { error: "Clock-in and clock-out used different unrecognized devices. Specify which one to approve." },
        { status: 409 }
      );
    }
    side = outFlagged ? "OUT" : "IN";
  }

  const targetDeviceId = side === "IN" ? attendance.deviceId : attendance.clockOutDeviceId;
  if (!targetDeviceId) {
    return NextResponse.json(
      { error: `No ${side === "IN" ? "clock-in" : "clock-out"} device recorded on this record.` },
      { status: 400 }
    );
  }

  await prisma.staff.update({
    where: { id: attendance.staffId },
    data: { boundDeviceId: targetDeviceId, deviceBoundAt: new Date() },
  });

  // Only clear a side's flag if its recorded device actually matches the one just approved —
  // the other side stays flagged if it was a genuinely different device.
  const data: { deviceStatus?: "MATCHED"; clockOutDeviceStatus?: "MATCHED" } = {};
  if (attendance.deviceId === targetDeviceId) data.deviceStatus = "MATCHED";
  if (attendance.clockOutDeviceId === targetDeviceId) data.clockOutDeviceStatus = "MATCHED";

  const record = await prisma.attendance.update({
    where: { id: attendance.id },
    data,
  });

  return NextResponse.json({ record });
}
