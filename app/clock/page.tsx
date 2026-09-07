"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Record = {
  clockIn: string | null;
  clockOut: string | null;
  status: string;
} | null;

export default function ClockPage() {
  const router = useRouter();
  const [record, setRecord] = useState<Record>(null);
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
  }

  function act(action: "IN" | "OUT") {
    setBusy(true);
    setMessage(null);
    if (!navigator.geolocation) {
      setBusy(false);
      setMessage({ text: "This device doesn't support location access.", kind: "error" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
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
      },
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <button onClick={logout} className="absolute top-6 right-6 text-sm text-muted hover:text-ink">
        Sign out
      </button>

      <div className="text-center mb-10">
        <div className="text-accent text-xs tracking-wide mb-2">iMarcProjects</div>
        <div className="font-display text-2xl italic text-muted">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      <div className="glass rounded-card p-8 w-full max-w-sm text-center space-y-6">
        <div>
          <p className="text-sm text-muted">Today</p>
          <p className="font-display text-xl mt-1">
            {hasClockedIn ? `In at ${fmtTime(record!.clockIn)}` : "Not clocked in"}
            {hasClockedOut ? ` · Out at ${fmtTime(record!.clockOut)}` : ""}
          </p>
          {record?.status === "LATE" && (
            <p className="text-late text-sm mt-1">Marked late</p>
          )}
        </div>

        {!hasClockedIn && (
          <button
            onClick={() => act("IN")}
            disabled={busy}
            className="focus-ring w-full rounded-md bg-accent hover:bg-accentDim transition-colors py-4 text-lg font-medium text-[#161207] disabled:opacity-60"
          >
            {busy ? "Locating…" : "Clock In"}
          </button>
        )}
        {hasClockedIn && !hasClockedOut && (
          <button
            onClick={() => act("OUT")}
            disabled={busy}
            className="focus-ring w-full rounded-md bg-surface2 border border-border hover:border-accent transition-colors py-4 text-lg font-medium disabled:opacity-60"
          >
            {busy ? "Locating…" : "Clock Out"}
          </button>
        )}
        {hasClockedIn && hasClockedOut && (
          <p className="text-good">Done for the day.</p>
        )}

        {message && (
          <p className={message.kind === "ok" ? "text-good text-sm" : "text-bad text-sm"}>
            {message.text}
          </p>
        )}
      </div>
    </main>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
