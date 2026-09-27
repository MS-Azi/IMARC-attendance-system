"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RulesAcknowledgementBanner from "@/app/_components/worklog/RulesAcknowledgementBanner";

type Slot = {
  id: string;
  label: string;
  status: "UPCOMING" | "OPEN_ON_TIME" | "OPEN_LATE" | "MISSED" | "ON_TIME" | "LATE" | "EXCUSED";
  note: string | null;
  link: string | null;
};
type Day = { date: string; slots: Slot[] };
type Counts = { LATE_SUBMISSION: number; MISSED_SUBMISSION: number; FALSE_SUBMISSION: number };

const STATUS_COLOR: Record<Slot["status"], string> = {
  UPCOMING: "text-muted",
  OPEN_ON_TIME: "text-accent",
  OPEN_LATE: "text-late",
  MISSED: "text-bad",
  ON_TIME: "text-good",
  LATE: "text-late",
  EXCUSED: "text-muted",
};

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MyRecordClient() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthStr());
  const [days, setDays] = useState<Day[]>([]);
  const [counts, setCounts] = useState<Counts>({ LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [month]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/worklog/me?month=${month}`);
    if (res.status === 401) return router.push("/login");
    const data = await res.json();
    setDays(data.days || []);
    setCounts(data.counts || { LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 });
    setLoading(false);
  }

  return (
    <main className="min-h-screen px-6 py-8 max-w-lg mx-auto">
      <RulesAcknowledgementBanner />

      <div className="flex items-center justify-between mb-6">
        <Link href="/clock" className="font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-ink">
          ← Clock
        </Link>
        <p className="font-mono text-accent text-[11px] tracking-[0.24em] uppercase">My Updates</p>
      </div>

      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="font-mono text-xs text-muted hover:text-ink">
          ‹ Prev
        </button>
        <p className="font-mono text-sm uppercase tracking-[0.12em]">{monthLabel(month)}</p>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="font-mono text-xs text-muted hover:text-ink">
          Next ›
        </button>
      </div>

      <div className="glass rounded-card p-4 mb-6 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-xl text-late">{counts.LATE_SUBMISSION}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Late</p>
        </div>
        <div>
          <p className="font-mono text-xl text-bad">{counts.MISSED_SUBMISSION}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Missed</p>
        </div>
        <div>
          <p className="font-mono text-xl text-bad">{counts.FALSE_SUBMISSION}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Flagged false</p>
        </div>
      </div>

      {!loading && days.length === 0 && (
        <p className="font-mono text-muted text-xs text-center py-8">No slots recorded this month.</p>
      )}

      <div className="space-y-4">
        {days
          .slice()
          .reverse()
          .map((day) => (
            <div key={day.date} className="glass rounded-card p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-2">
                {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <div className="space-y-1.5">
                {day.slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between font-mono text-xs">
                    <span>{s.label}</span>
                    <span className={`uppercase tracking-[0.08em] text-[11px] ${STATUS_COLOR[s.status]}`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}
