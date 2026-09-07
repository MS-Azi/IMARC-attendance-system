"use client";

import { useEffect, useState } from "react";

type Rec = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  overridden: boolean;
  staff: { fullName: string; department: string | null };
};

export default function LogPage() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState("");

  useEffect(() => {
    load();
  }, [from, to, status]);

  async function load() {
    const params = new URLSearchParams({ from, to });
    if (status) params.set("status", status);
    const res = await fetch(`/api/attendance?${params}`);
    const data = await res.json();
    setRecords(data.records || []);
  }

  function exportUrl() {
    const params = new URLSearchParams({ from, to });
    return `/api/export?${params}`;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-7">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1 glow">Attendance Log</h1>
          <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">{records.length} records</p>
        </div>
        <a
          href={exportUrl()}
          className="focus-ring glow-box self-start sm:self-auto rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white"
        >
          Download Excel
        </a>
      </div>

      <div className="glass rounded-card p-4 mb-6 flex flex-wrap gap-3 md:gap-4 items-end">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="ON_TIME">On time</option>
            <option value="LATE">Late</option>
            <option value="ANOMALY">Anomaly</option>
          </select>
        </div>
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Date</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Staff</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock In</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock Out</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{r.staff.fullName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{fmt(r.clockIn)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{fmt(r.clockOut)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">
                    <StatusBadge status={r.status} />
                    {r.overridden && <span className="font-mono text-muted text-[10px] uppercase tracking-[0.1em] ml-2">(edited)</span>}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 md:px-5 text-center text-muted">No records in this range.</td></tr>
              )}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ON_TIME: "text-good",
    LATE: "text-late",
    ABSENT: "text-bad",
    ANOMALY: "text-bad",
  };
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${map[status] || "text-muted"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
