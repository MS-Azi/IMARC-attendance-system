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

export function statusForClockIn(clockIn: Date, lateThreshold: string): "ON_TIME" | "LATE" {
  const minutesSinceMidnight = clockIn.getUTCHours() * 60 + clockIn.getUTCMinutes();
  return minutesSinceMidnight >= parseHHMM(lateThreshold) ? "LATE" : "ON_TIME";
}
