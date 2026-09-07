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
      <h1 className="font-display text-2xl italic mb-1">Today</h1>
      <p className="text-muted text-sm mb-7">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Currently in" value={clockedIn.length} />
        <Stat label="Total recorded" value={records.length} />
        <Stat label="Late today" value={late.length} tone="late" />
      </div>

      <div className="glass rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-3 font-normal">Staff</th>
              <th className="px-5 py-3 font-normal">Department</th>
              <th className="px-5 py-3 font-normal">Clock In</th>
              <th className="px-5 py-3 font-normal">Clock Out</th>
              <th className="px-5 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && records.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No attendance recorded yet today.</td></tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{r.staff.fullName}</td>
                <td className="px-5 py-3 text-muted">{r.staff.department || "—"}</td>
                <td className="px-5 py-3">{fmt(r.clockIn)}</td>
                <td className="px-5 py-3">{fmt(r.clockOut)}</td>
                <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "late" }) {
  return (
    <div className="glass rounded-card px-5 py-4">
      <div className="text-muted text-xs mb-1">{label}</div>
      <div className={`font-display text-3xl ${tone === "late" ? "text-late" : "text-ink"}`}>{value}</div>
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
