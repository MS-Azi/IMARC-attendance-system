"use client";

import { useEffect, useState } from "react";

type PerStaff = {
  name: string;
  department: string | null;
  onTime: number;
  late: number;
  absent: number;
  anomalies: number;
  attendancePct: number;
};

type Summary = {
  totalStaff: number;
  overallAttendancePct: number;
  totalLate: number;
  totalAbsent: number;
  totalAnomalies: number;
  perStaff: PerStaff[];
};

type Report = {
  id: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
  summaryJson: string;
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthValue());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetch("/api/reports").then((r) => r.json()).then((d) => setReports(d.reports || []));
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    const [year, m] = month.split("-").map(Number);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month: m }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setGenError(data.error || "Failed to generate report.");
      return;
    }
    setExpanded(data.report.id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1 glow">Monthly Reports</h1>
      <p className="font-mono text-muted text-[11px] uppercase tracking-[0.16em] leading-relaxed mb-5">
        Generated automatically on the 1st of each month, or generate any past month on demand.
      </p>

      <div className="glass rounded-card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-ink mb-1.5">Month</label>
          <input
            type="month"
            value={month}
            max={currentMonthValue()}
            onChange={(e) => setMonth(e.target.value)}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={generate}
          disabled={generating || !month}
          className="focus-ring glow-box rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate report"}
        </button>
        {genError && <p className="font-mono text-bad text-xs">{genError}</p>}
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Period</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Generated</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Overall attendance</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const summary: Summary = JSON.parse(r.summaryJson);
                const isOpen = expanded === r.id;
                return (
                  <>
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{r.periodLabel}</td>
                      <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums text-muted">
                        {new Date(r.generatedAt).toLocaleDateString()} <span className="text-[10px]">· {r.generatedBy}</span>
                      </td>
                      <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono tabular-nums">{summary.overallAttendancePct}%</td>
                      <td className="px-3 py-2.5 md:px-5 md:py-3 whitespace-nowrap">
                        <button
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="focus-ring font-mono text-[11px] uppercase tracking-[0.1em] underline mr-4"
                        >
                          {isOpen ? "Hide" : "View"}
                        </button>
                        <a
                          href={`/api/reports/${r.id}/download`}
                          className="focus-ring font-mono text-[11px] uppercase tracking-[0.1em] underline"
                        >
                          Download .xlsx
                        </a>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-detail`} className="border-b border-border last:border-0">
                        <td colSpan={4} className="px-3 py-3 md:px-5 bg-surface2">
                          <p className="font-mono text-[11px] text-muted mb-2">
                            {summary.totalStaff} staff · {summary.totalLate} late · {summary.totalAbsent} absent · {summary.totalAnomalies} flagged anomalies
                          </p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-border">
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">Staff</th>
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">Dept</th>
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">On time</th>
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">Late</th>
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">Absent</th>
                                <th className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">Attendance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.perStaff.map((p) => (
                                <tr key={p.name} className="border-b border-border last:border-0">
                                  <td className="px-2 py-1.5">{p.name}</td>
                                  <td className="px-2 py-1.5 text-muted">{p.department ?? "-"}</td>
                                  <td className="px-2 py-1.5 font-mono tabular-nums">{p.onTime}</td>
                                  <td className="px-2 py-1.5 font-mono tabular-nums">{p.late}</td>
                                  <td className="px-2 py-1.5 font-mono tabular-nums">{p.absent}</td>
                                  <td className="px-2 py-1.5 font-mono tabular-nums">{p.attendancePct}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {reports.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 md:px-5 text-center text-muted">No monthly reports generated yet. The first one runs automatically on the 1st.</td></tr>
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
