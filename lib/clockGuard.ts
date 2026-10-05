import { isWithinRadius } from "./geo";

export type WorkMode = "OFFICE" | "REMOTE";

export type ClockLocationInput = {
  workMode: WorkMode;
  lat: number | null;
  lng: number | null;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
};

export type ClockLocationResult =
  | { allowed: true; locationShared: boolean }
  | { allowed: false; error: string; status: 400 | 403 };

/**
 * Decides whether a clock-in/out attempt may proceed, and whether its location
 * counts as "shared". OFFICE behavior is unchanged from before REMOTE existed:
 * location is required and must be within the geofence. REMOTE skips the geofence
 * entirely (and tolerates no location at all) but never fails for it.
 */
export function resolveClockLocation(input: ClockLocationInput): ClockLocationResult {
  const hasLocation = typeof input.lat === "number" && typeof input.lng === "number";

  if (input.workMode === "REMOTE") {
    return { allowed: true, locationShared: hasLocation };
  }

  if (!hasLocation) {
    return { allowed: false, status: 400, error: "Location was not captured. Enable location access and try again." };
  }
  if (!isWithinRadius(input.lat as number, input.lng as number, input.officeLat, input.officeLng, input.radiusMeters)) {
    return { allowed: false, status: 403, error: "You are outside the approved office location, so this attempt was not recorded." };
  }
  return { allowed: true, locationShared: true };
}
