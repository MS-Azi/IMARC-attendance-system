"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RuleSetConfig, OFFENCE_TYPES, DEFAULT_GRADE_KEY } from "@/lib/worklog/config";
import { fmtDate, fmt12h, offenceLabel, summarizeLadder } from "@/lib/worklog/format";

type CurrentRuleSet = RuleSetConfig & { id: string; version: number; effectiveFrom: string };

export default function FullRulesClient() {
  const [ruleSet, setRuleSet] = useState<CurrentRuleSet | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/worklog/rules/current")
      .then((r) => r.json())
      .then((d) => setRuleSet(d.ruleSet))
      .catch(() => setRuleSet(null));
  }, []);

  const gradeKeys = ruleSet?.amountsApply === "BY_GRADE" ? ruleSet.grades : [DEFAULT_GRADE_KEY];

  return (
    <main className="min-h-screen px-6 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/clock" className="font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-ink">
          ← Clock
        </Link>
        <p className="font-mono text-accent text-[11px] tracking-[0.24em] uppercase">Work Update Rules</p>
      </div>

      {ruleSet === undefined && <p className="font-mono text-muted text-xs uppercase tracking-[0.15em]">Loading…</p>}
      {ruleSet === null && <p className="font-mono text-muted text-xs">No rules published yet.</p>}

      {ruleSet && (
        <div className="space-y-6">
          <p className="font-mono text-[11px] text-muted">Effective {fmtDate(ruleSet.effectiveFrom)}.</p>

          <section className="glass rounded-card p-4 md:p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink mb-3">Slots</h2>
            <ul className="font-mono text-sm space-y-1.5">
              {ruleSet.slots.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>{s.label}</span>
                  <span className="text-muted">due {fmt12h(s.time)}</span>
                </li>
              ))}
            </ul>
            <p className="font-mono text-[11px] text-muted mt-3">
              A slot opens up to its "opens before" minutes early, stays on-time until its "on-time after" minutes pass, then
              stays open (as late) until the next slot opens — or, for the last slot, until {fmt12h(ruleSet.lastSlotLateCloseTime)}.
            </p>
          </section>

          <section className="glass rounded-card p-4 md:p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink mb-3">Offences &amp; amounts</h2>
            <p className="font-mono text-[11px] text-muted mb-4">
              {ruleSet.deductionsEnabled
                ? `Deductions are active this month, capped at ${ruleSet.capPercent}% of salary.`
                : "Deductions are currently in warning-only mode — the figures below show what would apply once turned on."}
            </p>
            {gradeKeys.map((grade) => (
              <div key={grade} className="mb-4 last:mb-0">
                {ruleSet.amountsApply === "BY_GRADE" && (
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-2">{grade}</p>
                )}
                <div className="space-y-2">
                  {OFFENCE_TYPES.map((t) => (
                    <div key={t} className="font-mono text-xs">
                      <p className="text-ink">
                        {offenceLabel(t)} — {ruleSet.warningAllowance[t]} warning{ruleSet.warningAllowance[t] === 1 ? "" : "s"} free
                      </p>
                      <p className="text-muted">{summarizeLadder(ruleSet.tierLadders[grade]?.[t] ?? [])}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="glass rounded-card p-4 md:p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink mb-3">Good to know</h2>
            <ul className="font-mono text-[11px] text-muted space-y-1.5">
              <li>• A false submission (ticked but not actually sent) counts only as a false submission — never also as late or missed.</li>
              <li>• An excused slot (approved leave, outage, etc.) counts as nothing — no offence, no warning used.</li>
              <li>• Offences keep being counted after the monthly cap is reached, even though no more is deducted.</li>
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
