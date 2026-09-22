import { DeviceStatus } from "@prisma/client";
import { prisma } from "./db";
import { parseHHMM } from "./geo";

/** Midnight UTC for the given date, used as the day key for attendance rows. */
export function dayKey(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 1, officeLat: 0, officeLng: 0, radiusMeters: 100 },
    });
  }
  return settings;
}

// The office (and lateThreshold, entered by the admin on their own local clock) is
// Africa/Lagos. clockIn is an absolute UTC instant, so it must be converted to Lagos
// wall-clock time before comparing — comparing raw UTC hours against the threshold
// silently shifts the effective cutoff by the UTC+1 offset.
const OFFICE_TIMEZONE = "Africa/Lagos";

function minutesSinceMidnightInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function statusForClockIn(clockIn: Date, lateThreshold: string): "ON_TIME" | "LATE" {
  const minutesSinceMidnight = minutesSinceMidnightInTimeZone(clockIn, OFFICE_TIMEZONE);
  return minutesSinceMidnight >= parseHHMM(lateThreshold) ? "LATE" : "ON_TIME";
}

/**
 * Binds/compares the device ID a check-in came from against what's on file for the staff
 * member. Never blocks the check-in itself — a mismatch is only flagged for admin review.
 */
export async function resolveDeviceStatus(
  staffId: string,
  deviceId: unknown
): Promise<{ deviceId: string | null; deviceStatus: DeviceStatus }> {
  if (typeof deviceId !== "string" || !deviceId.trim()) {
    return { deviceId: null, deviceStatus: DeviceStatus.MATCHED };
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { boundDeviceId: true },
  });

  if (!staff?.boundDeviceId) {
    await prisma.staff.update({
      where: { id: staffId },
      data: { boundDeviceId: deviceId, deviceBoundAt: new Date() },
    });
    return { deviceId, deviceStatus: DeviceStatus.UNVERIFIED };
  }

  if (staff.boundDeviceId === deviceId) {
    return { deviceId, deviceStatus: DeviceStatus.MATCHED };
  }

  return { deviceId, deviceStatus: DeviceStatus.MISMATCH };
}
