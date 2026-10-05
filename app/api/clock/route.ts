import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveClockLocation } from "@/lib/clockGuard";
import { getSettings, dayKey, statusForClockIn, resolveDeviceStatus } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const { action, lat, lng, accuracy, deviceId } = await req.json();
  const staff = await prisma.staff.findUnique({ where: { id: session.sub }, select: { workMode: true } });
  if (!staff) {
    return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
  }

  const settings = await getSettings();
  const location = resolveClockLocation({
    workMode: staff.workMode,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    officeLat: settings.officeLat,
    officeLng: settings.officeLng,
    radiusMeters: settings.radiusMeters,
  });
  if (!location.allowed) {
    return NextResponse.json({ error: location.error }, { status: location.status });
  }
  const recordedLat = location.locationShared ? lat : null;
  const recordedLng = location.locationShared ? lng : null;
  const recordedAccuracy = location.locationShared && typeof accuracy === "number" ? accuracy : null;

  const today = dayKey();
  const now = new Date();

  if (action === "IN") {
    const existing = await prisma.attendance.findUnique({
      where: { staffId_date: { staffId: session.sub, date: today } },
    });
    if (existing?.clockIn) {
      return NextResponse.json({ error: "You already clocked in today." }, { status: 409 });
    }
    const status = statusForClockIn(now, settings.lateThreshold);
    const device = await resolveDeviceStatus(session.sub, deviceId);
    const record = await prisma.attendance.upsert({
      where: { staffId_date: { staffId: session.sub, date: today } },
      create: {
        staffId: session.sub,
        date: today,
        clockIn: now,
        clockInLat: recordedLat,
        clockInLng: recordedLng,
        clockInAccuracy: recordedAccuracy,
        locationShared: location.locationShared,
        status,
        deviceId: device.deviceId,
        deviceStatus: device.deviceStatus,
      },
      update: {
        clockIn: now,
        clockInLat: recordedLat,
        clockInLng: recordedLng,
        clockInAccuracy: recordedAccuracy,
        locationShared: location.locationShared,
        status,
        deviceId: device.deviceId,
        deviceStatus: device.deviceStatus,
      },
    });
    return NextResponse.json({ ok: true, record });
  }

  if (action === "OUT") {
    const existing = await prisma.attendance.findUnique({
      where: { staffId_date: { staffId: session.sub, date: today } },
    });
    if (!existing?.clockIn) {
      return NextResponse.json({ error: "Clock in first before clocking out." }, { status: 409 });
    }
    if (existing.clockOut) {
      return NextResponse.json({ error: "You already clocked out today." }, { status: 409 });
    }
    const device = await resolveDeviceStatus(session.sub, deviceId);
    const record = await prisma.attendance.update({
      where: { staffId_date: { staffId: session.sub, date: today } },
      data: {
        clockOut: now,
        clockOutLat: recordedLat,
        clockOutLng: recordedLng,
        clockOutAccuracy: recordedAccuracy,
        locationShared: location.locationShared,
        clockOutDeviceId: device.deviceId,
        clockOutDeviceStatus: device.deviceStatus,
      },
    });
    return NextResponse.json({ ok: true, record });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }
  const today = dayKey();
  const [record, staff] = await Promise.all([
    prisma.attendance.findUnique({ where: { staffId_date: { staffId: session.sub, date: today } } }),
    prisma.staff.findUnique({ where: { id: session.sub }, select: { workMode: true } }),
  ]);
  return NextResponse.json({ record, workMode: staff?.workMode ?? "OFFICE" });
}
