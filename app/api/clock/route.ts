import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWithinRadius } from "@/lib/geo";
import { getSettings, dayKey, statusForClockIn } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Sign in as a staff member first." }, { status: 401 });
  }

  const { action, lat, lng } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "Location was not captured. Enable location access and try again." },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const within = isWithinRadius(lat, lng, settings.officeLat, settings.officeLng, settings.radiusMeters);
  if (!within) {
    return NextResponse.json(
      { error: "You are outside the approved office location, so this attempt was not recorded." },
      { status: 403 }
    );
  }

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
    const record = await prisma.attendance.upsert({
      where: { staffId_date: { staffId: session.sub, date: today } },
      create: { staffId: session.sub, date: today, clockIn: now, clockInLat: lat, clockInLng: lng, status },
      update: { clockIn: now, clockInLat: lat, clockInLng: lng, status },
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
    const record = await prisma.attendance.update({
      where: { staffId_date: { staffId: session.sub, date: today } },
      data: { clockOut: now, clockOutLat: lat, clockOutLng: lng },
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
  const record = await prisma.attendance.findUnique({
    where: { staffId_date: { staffId: session.sub, date: today } },
  });
  return NextResponse.json({ record });
}
