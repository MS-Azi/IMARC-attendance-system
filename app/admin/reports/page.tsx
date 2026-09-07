"use client";

import { useEffect, useState } from "react";

type Report = {
  id: string;
  periodLabel: string;
  generatedAt: string;
  emailedTo: string;
  summaryJson: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    fetch("/api/reports").then((r) => r.json()).then((d) => setReports(d.reports || []));
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl italic mb-1 glow">Monthly Reports</h1>
      <p className="text-muted text-sm mb-7">
        Generated automatically on the 1st of each month and emailed to the address set in Settings.
      </p>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Period</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Generated</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Sent to</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal">Overall attendance</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const summary = JSON.parse(r.summaryJson);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 md:px-5 md:py-3">{r.periodLabel}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{new Date(r.generatedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{r.emailedTo}</td>
                    <td className="px-3 py-2.5 md:px-5 md:py-3">{summary.overallAttendancePct}%</td>
                  </tr>
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
