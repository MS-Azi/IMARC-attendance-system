"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  actorType: "ADMIN" | "STAFF";
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
};

export default function ChangeLogClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/worklog/auditlog")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1">Change Log</h1>
      <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em] mb-7">
        Rule changes, reviews, salary changes, and month finalizations
      </p>

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">When</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Who</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Action</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Reason</th>
              </tr>
            </thead>
            <tbody>
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 md:px-5 text-center text-muted">No changes logged yet.</td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-muted whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{e.actorName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] uppercase tracking-[0.08em]">{e.action}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{e.reason || "—"}</td>
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
