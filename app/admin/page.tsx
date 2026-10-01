"use client";

import { useEffect, useState } from "react";
import CornerBrackets from "@/app/_components/CornerBrackets";
import { useTilt } from "@/app/_components/useTilt";
import DeviceFlagTime from "@/app/_components/DeviceFlagTime";

type Rec = {
  id: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  deviceStatus: string;
  clockOutDeviceStatus: string | null;
  staff: { fullName: string; department: string | null };
};

const BACKUP_REMINDER_DAYS = 30;

export default function AdminLivePage() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastBackupAt, setLastBackupAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/admin/backup/last")
      .then((r) => r.json())
      .then((d) => setLastBackupAt(d.lastBackupAt))
      .catch(() => setLastBackupAt(null));
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

  const daysSinceBackup = lastBackupAt ? (Date.now() - new Date(lastBackupAt).getTime()) / 86400000 : null;
  const backupStale = lastBackupAt === null || (daysSinceBackup !== null && daysSinceBackup > BACKUP_REMINDER_DAYS);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1 glow">Today</h1>
      <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em] mb-7">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>

      {lastBackupAt !== undefined && backupStale && (
        <a
          href="/admin/backup"
          className="focus-ring glass rounded-card p-3.5 mb-7 flex items-center justify-between gap-3 block hover:bg-surface2 transition-colors"
        >
          <span className="font-mono text-late text-[11px] uppercase tracking-[0.1em]">
            Last backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString() : "never"}. Download a fresh copy.
          </span>
          <span className="font-mono text-late text-[11px] uppercase tracking-[0.1em] underline shrink-0">Go →</span>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Stat label="Currently in" value={clockedIn.length} live />
        <Stat label="Total recorded" value={records.length} />
        <Stat label="Late today" value={late.length} tone="late" />
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Staff</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Department</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock In</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock Out</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Status</th>
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
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">
                    <DeviceFlagTime time={r.clockIn} flagged={r.deviceStatus === "MISMATCH"} />
                  </td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">
                    <DeviceFlagTime time={r.clockOut} flagged={r.clockOutDeviceStatus === "MISMATCH"} />
                  </td>
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
  const tilt = useTilt<HTMLDivElement>(5);
  return (
    <div
      ref={tilt}
      className="tilt glass card-glow-hover relative rounded-card px-4 py-3.5 md:px-5 md:py-4"
    >
      <CornerBrackets />
      <div className="flex items-center gap-2 mb-1">
        {live && <span className="live-dot" />}
        <span className="font-mono text-muted text-[11px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div
        className={`font-mono text-3xl font-medium tabular-nums ${
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
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${map[status] || "text-muted"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
