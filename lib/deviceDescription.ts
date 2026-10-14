/**
 * Browser/phone description stored on Attendance.clockInUserAgent / clockOutUserAgent.
 * Display-only (Device Review) — device binding and flagging never read it.
 *
 * Stored as JSON: { ua, model?, platformVersion? }. `ua` is the request's User-Agent
 * header; `model`/`platformVersion` come from UA Client Hints where the browser
 * supports them, because Chrome on Android reduces the UA's model to "K".
 */

type Stored = { ua: string; model?: string; platformVersion?: string };

function clean(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function buildDeviceDescription(userAgent: string | null, hints: unknown): string | null {
  const ua = clean(userAgent, 512);
  if (!ua) return null;
  const h = (hints && typeof hints === "object" ? hints : {}) as Record<string, unknown>;
  const stored: Stored = { ua, model: clean(h.model, 100), platformVersion: clean(h.platformVersion, 40) };
  return JSON.stringify(stored);
}

export type DeviceSummary = {
  /** Short human label, e.g. "Android 14 · SM-A155F · Chrome 129". */
  label: string;
  /** A real hardware model, or null when unknown (reduced "K", iPhone, desktop). */
  model: string | null;
  /** Full raw User-Agent, for a hover tooltip. */
  full: string;
};

function browserOf(ua: string): string {
  const pick = (re: RegExp, name: string) => {
    const m = ua.match(re);
    return m ? `${name} ${m[1].split(".")[0]}` : null;
  };
  return (
    pick(/SamsungBrowser\/([\d.]+)/, "Samsung Internet") ||
    pick(/(?:OPR|Opera)\/([\d.]+)/, "Opera") ||
    pick(/Edg(?:A|iOS)?\/([\d.]+)/, "Edge") ||
    pick(/(?:Firefox|FxiOS)\/([\d.]+)/, "Firefox") ||
    pick(/CriOS\/([\d.]+)/, "Chrome") ||
    (/; wv\)/.test(ua) ? "Android WebView" : null) ||
    pick(/Chrome\/([\d.]+)/, "Chrome") ||
    pick(/Version\/([\d.]+).*Safari/, "Safari") ||
    "Unknown browser"
  );
}

export function summarizeDevice(stored: string | null): DeviceSummary | null {
  if (!stored) return null;
  let d: Stored;
  try {
    d = JSON.parse(stored);
  } catch {
    d = { ua: stored };
  }
  const ua = d.ua || "";
  const browser = browserOf(ua);

  const ios = ua.match(/\((iPhone|iPad|iPod)[^)]*OS ([\d_]+)/);
  if (ios) {
    // iOS never exposes the model — show the device family only, no model claim.
    return { label: `${ios[1]} · ${browser} / iOS ${ios[2].replace(/_/g, ".")}`, model: null, full: ua };
  }

  const android = ua.match(/Android ([\d.]+)(?:; ([^;)]+))?/);
  if (android) {
    const uaModel = android[2]?.replace(/ Build\/.*/, "").trim();
    const model = d.model || (uaModel && uaModel !== "K" ? uaModel : undefined) || null;
    // A reduced UA ("Android 10; K") freezes the version too, so it's only trusted when unreduced.
    const version = d.platformVersion ? d.platformVersion.split(".")[0] : uaModel === "K" ? null : android[1];
    const os = version ? `Android ${version}` : "Android";
    return { label: [os, model ?? "model unknown", browser].join(" · "), model, full: ua };
  }

  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { label: `${os} · ${browser}`, model: null, full: ua };
}
