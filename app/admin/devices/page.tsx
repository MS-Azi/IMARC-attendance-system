"use client";

import { useEffect, useState } from "react";
import { summarizeDevice, type DeviceSummary } from "@/lib/deviceDescription";

type DeviceStatus = "MATCHED" | "UNVERIFIED" | "MISMATCH";

type Rec = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  deviceId: string | null;
  deviceStatus: DeviceStatus;
  clockOutDeviceId: string | null;
  clockOutDeviceStatus: DeviceStatus | null;
  clockInUserAgent: string | null;
  clockOutUserAgent: string | null;
  boundDeviceUserAgent: string | null;
  flaggedActions: ("IN" | "OUT")[];
  staff: { fullName: string; department: string | null };
};

export default function DevicesPage() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/attendance/devices");
    const data = await res.json();
    setRecords(data.records || []);
    setLoading(false);
  }

  async function approve(id: string, action?: "IN" | "OUT") {
    setBusyId(id);
    await fetch(`/api/attendance/${id}/approve-device`, {
      method: "POST",
      headers: action ? { "Content-Type": "application/json" } : undefined,
      body: action ? JSON.stringify({ action }) : undefined,
    });
    await load();
    setBusyId(null);
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1">Device Review</h1>
        <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">
          {records.length} check-in{records.length === 1 ? "" : "s"} to review
        </p>
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Date</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Staff</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock In</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock Out</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Flagged</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Device</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 md:px-5 text-center text-muted">Nothing flagged for review.</td></tr>
              )}
              {records.map((r) => {
                const bothFlaggedDifferently =
                  r.flaggedActions.includes("IN") &&
                  r.flaggedActions.includes("OUT") &&
                  r.deviceId !== r.clockOutDeviceId;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3">{r.staff.fullName}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{fmt(r.clockIn)}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{fmt(r.clockOut)}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3">
                      <div className="flex flex-col gap-1">
                        {r.flaggedActions.includes("IN") && <DeviceBadge action="IN" status={r.deviceStatus} />}
                        {r.flaggedActions.includes("OUT") && r.clockOutDeviceStatus && (
                          <DeviceBadge action="OUT" status={r.clockOutDeviceStatus} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3">
                      <DeviceCompare record={r} />
                    </td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3 text-right space-x-3 whitespace-nowrap">
                      {bothFlaggedDifferently ? (
                        <>
                          <button
                            onClick={() => approve(r.id, "IN")}
                            disabled={busyId === r.id}
                            className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:text-accentDim disabled:opacity-60"
                          >
                            Approve IN
                          </button>
                          <button
                            onClick={() => approve(r.id, "OUT")}
                            disabled={busyId === r.id}
                            className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:text-accentDim disabled:opacity-60"
                          >
                            Approve OUT
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => approve(r.id)}
                          disabled={busyId === r.id}
                          className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:text-accentDim disabled:opacity-60"
                        >
                          {busyId === r.id ? "Approving…" : "Approve device"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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

function DeviceBadge({ action, status }: { action: "IN" | "OUT"; status: DeviceStatus }) {
  const map: Record<string, string> = {
    MISMATCH: "text-bad",
    UNVERIFIED: "text-late",
    MATCHED: "text-good",
  };
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${map[status] || "text-muted"}`}>
      {action}: {status}
    </span>
  );
}

/** Flagged side(s) vs the bound device. Green/red only when both sides report a real
 * hardware model; otherwise neutral with no verdict (reduced Android UA, iPhone, desktop). */
function DeviceCompare({ record: r }: { record: Rec }) {
  const bound = summarizeDevice(r.boundDeviceUserAgent);
  const sides: { label: string; ua: string | null }[] = [];
  if (r.flaggedActions.includes("IN")) sides.push({ label: "In", ua: r.clockInUserAgent });
  if (r.flaggedActions.includes("OUT") && !(r.flaggedActions.includes("IN") && r.clockOutDeviceId === r.deviceId)) {
    sides.push({ label: "Out", ua: r.clockOutUserAgent });
  }
  return (
    <div className="flex flex-col gap-1 text-[12px] leading-snug">
      {sides.map((side) => {
        const d = summarizeDevice(side.ua);
        const verdict = d?.model && bound?.model ? (d.model.toLowerCase() === bound.model.toLowerCase() ? "same" : "different") : null;
        return (
          <DeviceLine
            key={side.label}
            label={side.label}
            device={d}
            className={verdict === "same" ? "text-good" : verdict === "different" ? "text-bad" : ""}
            suffix={verdict === "same" ? " — same model" : verdict === "different" ? " — different model" : ""}
          />
        );
      })}
      <DeviceLine label="Bound" device={bound} className="text-muted" suffix="" />
    </div>
  );
}

function DeviceLine({ label, device, className, suffix }: { label: string; device: DeviceSummary | null; className: string; suffix: string }) {
  return (
    <div className={className} title={device?.full}>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mr-1.5">{label}</span>
      {device ? device.label + suffix : <span className="text-muted">not recorded yet</span>}
    </div>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
