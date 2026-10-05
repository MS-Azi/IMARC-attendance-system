"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CornerBrackets from "@/app/_components/CornerBrackets";
import { useTilt } from "@/app/_components/useTilt";
import { getDeviceId } from "@/lib/deviceId";
import TodaysUpdatesCard from "@/app/_components/worklog/TodaysUpdatesCard";
import RulesAcknowledgementBanner from "@/app/_components/worklog/RulesAcknowledgementBanner";
import PushSetupPrompt from "@/app/_components/worklog/PushSetupPrompt";

const WORKLOG_ENABLED = process.env.NEXT_PUBLIC_WORKLOG_ENABLED === "true";

type Record = {
  clockIn: string | null;
  clockOut: string | null;
  status: string;
} | null;

type LocationErrorType = "denied" | "unavailable" | "timeout";

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

function classifyGeoError(err: GeolocationPositionError): LocationErrorType {
  if (err.code === err.PERMISSION_DENIED) return "denied";
  if (err.code === err.TIMEOUT) return "timeout";
  return "unavailable";
}

export default function ClockPage() {
  const router = useRouter();
  const [record, setRecord] = useState<Record>(null);
  const [workMode, setWorkMode] = useState<"OFFICE" | "REMOTE">("OFFICE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    const res = await fetch("/api/clock");
    if (res.status === 401) return router.push("/login");
    const data = await res.json();
    setRecord(data.record);
    setWorkMode(data.workMode || "OFFICE");
  }

  async function submit(
    action: "IN" | "OUT",
    lat: number | null,
    lng: number | null,
    accuracy: number | null,
    locationError: LocationErrorType | null
  ) {
    const res = await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, lat, lng, accuracy, locationError, deviceId: getDeviceId() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ text: data.error, kind: "error" });
      return;
    }
    setMessage({
      text: action === "IN" ? "Clocked in." : "Clocked out.",
      kind: "ok",
    });
    refresh();
  }

  /** REMOTE only: a real GPS fix, then one lower-accuracy retry, before giving up.
   * Never blocks the clock-in — whatever happens, it still submits. */
  async function actRemote(action: "IN" | "OUT") {
    try {
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
      submit(action, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, null);
      return;
    } catch (err) {
      const type = classifyGeoError(err as GeolocationPositionError);
      if (type === "denied") {
        submit(action, null, null, null, type);
        return;
      }
    }
    try {
      const pos = await getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
      submit(action, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, null);
    } catch (err) {
      submit(action, null, null, null, classifyGeoError(err as GeolocationPositionError));
    }
  }

  function act(action: "IN" | "OUT") {
    setBusy(true);
    setMessage(null);
    if (!navigator.geolocation) {
      if (workMode === "REMOTE") {
        submit(action, null, null, null, "unavailable");
        return;
      }
      setBusy(false);
      setMessage({ text: "This device doesn't support location access.", kind: "error" });
      return;
    }
    if (workMode === "REMOTE") {
      actRemote(action);
      return;
    }
    // OFFICE — unchanged from before REMOTE work mode existed.
    navigator.geolocation.getCurrentPosition(
      (pos) => submit(action, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, null),
      () => {
        setBusy(false);
        setMessage({ text: "Location access was denied. Allow location and try again.", kind: "error" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const hasClockedIn = !!record?.clockIn;
  const hasClockedOut = !!record?.clockOut;
  const cardTilt = useTilt<HTMLDivElement>(4);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Never shown before clock-in — a rules nag must not be able to delay or block
          the time-critical clock-in action. Only mounts once already clocked in today. */}
      {WORKLOG_ENABLED && hasClockedIn && <RulesAcknowledgementBanner />}

      {WORKLOG_ENABLED && (
        <Link
          href="/worklog/me"
          className="absolute top-6 left-6 font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-ink"
        >
          My Updates
        </Link>
      )}
      <button
        onClick={logout}
        className="absolute top-6 right-6 font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-ink"
      >
        Sign out
      </button>

      <div className="reveal text-center mb-10">
        <div className="font-mono text-accent text-[11px] tracking-[0.28em] uppercase mb-3 glow">
          iMarcProjects
        </div>
        <div className="font-mono text-6xl font-medium text-ink glow tabular-nums tracking-tight">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div className="font-mono text-muted text-[11px] tracking-[0.18em] uppercase mt-3">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div
        ref={cardTilt}
        className="tilt glass card-glow-hover relative rounded-card p-8 w-full max-w-sm text-center space-y-6"
      >
        <CornerBrackets />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Today</p>
          <p className="font-mono text-lg mt-2 tracking-tight">
            {hasClockedIn ? `In at ${fmtTime(record!.clockIn)}` : "Not clocked in"}
            {hasClockedOut ? ` · Out at ${fmtTime(record!.clockOut)}` : ""}
          </p>
          {record?.status === "LATE" && (
            <p className="font-mono text-late text-[11px] uppercase tracking-[0.15em] mt-1.5">Marked late</p>
          )}
        </div>

        {workMode === "REMOTE" && (
          <p className="font-mono text-muted text-[11px] uppercase tracking-[0.1em]">
            Remote mode: your location is recorded at clock-in.
          </p>
        )}

        {!hasClockedIn && (
          <button
            onClick={() => act("IN")}
            disabled={busy}
            className="focus-ring glow-box relative w-full rounded-md bg-accent hover:bg-accentDim transition-colors py-4 font-mono text-sm uppercase tracking-[0.2em] font-medium text-white disabled:opacity-60"
          >
            <CornerBrackets />
            {busy ? (workMode === "REMOTE" ? "Getting your location…" : "Locating…") : "Clock In"}
          </button>
        )}
        {hasClockedIn && !hasClockedOut && (
          <button
            onClick={() => act("OUT")}
            disabled={busy}
            className="focus-ring relative w-full rounded-md bg-surface2 border border-border hover:border-accent transition-colors py-4 font-mono text-sm uppercase tracking-[0.2em] font-medium disabled:opacity-60"
          >
            <CornerBrackets />
            {busy ? (workMode === "REMOTE" ? "Getting your location…" : "Locating…") : "Clock Out"}
          </button>
        )}
        {hasClockedIn && hasClockedOut && (
          <p className="font-mono text-good text-sm uppercase tracking-[0.12em]">Done for the day.</p>
        )}

        {message && (
          <p className={message.kind === "ok" ? "font-mono text-good text-xs" : "font-mono text-bad text-xs"}>
            {message.text}
          </p>
        )}
      </div>

      {WORKLOG_ENABLED && <TodaysUpdatesCard />}
      {WORKLOG_ENABLED && <PushSetupPrompt />}
    </main>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
