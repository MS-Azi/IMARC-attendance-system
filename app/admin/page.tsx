"use client";

import { useEffect, useState } from "react";

type Rec = {
  id: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  staff: { fullName: string; department: string | null };
};

export default function AdminLivePage() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/attendance?from=${today}&to=${today}`);
    const data = await res.json();
    setRecords(data.records || []);
    setLoading(false);
  }

  const clockedIn = records.filter((r) => r.clockIn && !r.clockOut);
  const late = records.filter((r) => r.status === "LATE");

  return (
    <div>
      <h1 className="font-display text-2xl italic mb-1 glow">Today</h1>
      <p className="text-muted text-sm mb-7">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Stat label="Currently in" value={clockedIn.length} live />
        <Stat label="Total recorded" value={records.length} />
        <Stat label="Late today" value={late.length} tone="late" />
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Staff</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Department</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Clock In</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Clock Out</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 md:px-5 text-center text-muted">No attendance recorded yet today.</td></tr>
              )}
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{r.staff.fullName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{r.staff.department || "—"}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{fmt(r.clockIn)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{fmt(r.clockOut)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-card bg-gradient-to-l from-surface to-transparent md:hidden"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone, live }: { label: string; value: number; tone?: "late"; live?: boolean }) {
  return (
    <div className="glass card-glow-hover rounded-card px-4 py-3.5 md:px-5 md:py-4">
      <div className="flex items-center gap-2 mb-1">
        {live && <span className="live-dot" />}
        <span className="text-muted text-xs uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div
        className={`font-display text-3xl ${
          live ? "text-accent glow" : tone === "late" ? "text-late" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ON_TIME: "text-good",
    LATE: "text-late",
    ABSENT: "text-bad",
    ANOMALY: "text-bad",
  };
  return <span className={map[status] || "text-muted"}>{status.replace("_", " ")}</span>;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
