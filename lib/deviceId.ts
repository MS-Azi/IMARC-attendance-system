const STORAGE_KEY = "imarc_device_id";

/** Persistent per-browser device ID, generated once and reused from localStorage. */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Real phone model / OS version from UA Client Hints (Chromium only — Chrome on Android
 * reduces the User-Agent model to "K"). Display-only, for Device Review. Capped at
 * 1.5s and never throws, so it can't hold up or break a clock-in.
 */
export async function getDeviceHints(): Promise<{ model?: string; platformVersion?: string } | null> {
  try {
    const uad = (navigator as any).userAgentData;
    if (!uad?.getHighEntropyValues) return null;
    const values = await Promise.race([
      uad.getHighEntropyValues(["model", "platformVersion"]),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (!values) return null;
    return { model: values.model || undefined, platformVersion: values.platformVersion || undefined };
  } catch {
    return null;
  }
}
