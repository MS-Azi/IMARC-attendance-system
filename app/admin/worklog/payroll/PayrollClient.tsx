"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/_components/ToastProvider";

type Line = {
  staffId: string;
  staffName: string;
  baseKobo: number;
  deductionsEnabled: boolean;
  breakdown: {
    subtotals: Record<string, number>;
    totalBeforeCapKobo: number;
    capKobo: number;
    totalDeductionKobo: number;
    capped: boolean;
    netKobo: number;
  };
};

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString()}`;
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollClient() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonthStr());
  const [lines, setLines] = useState<Line[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    load();
  }, [month]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/worklog/payroll?month=${month}`);
    const data = await res.json();
    setLines(data.lines || []);
    setFinalized(!!data.finalized);
    setLoading(false);
  }

  async function finalize() {
    if (!confirm(`Finalize ${month}? This locks all review actions and figures for the month.`)) return;
    setFinalizing(true);
    const res = await fetch(`/api/admin/worklog/payroll/${month}/finalize`, { method: "POST" });
    const data = await res.json();
    setFinalizing(false);
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast(`Finalized ${month}.`);
    load();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1">Monthly Payroll</h1>
          <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">
            {finalized ? "Finalized — read only" : "Provisional — recalculates on every review change"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
          />
          <a
            href={`/api/admin/worklog/payroll/${month}/export`}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline"
          >
            Export CSV
          </a>
          {!finalized && (
            <button
              onClick={finalize}
              disabled={finalizing}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-bad hover:underline disabled:opacity-60"
            >
              {finalizing ? "Finalizing…" : "Finalize month"}
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="text-left border-b border-border">
                {["Staff", "Base", "Before cap", "Cap", "Deduction", "Net", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 md:px-5 text-center text-muted">
                    No staff with salary on file, or nothing to show.
                  </td>
                </tr>
              )}
              {lines.map((l) => (
                <tr key={l.staffId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{l.staffName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono">{naira(l.baseKobo)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono">{naira(l.breakdown.totalBeforeCapKobo)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-muted">{naira(l.breakdown.capKobo)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono">
                    {naira(l.breakdown.totalDeductionKobo)}
                    {!l.deductionsEnabled && <span className="text-muted"> (would be)</span>}
                  </td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono">{naira(l.breakdown.netKobo)}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">
                    {l.breakdown.capped && <span className="font-mono text-[11px] text-bad uppercase tracking-[0.1em]">Hit cap</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
