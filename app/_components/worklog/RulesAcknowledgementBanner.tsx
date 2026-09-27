"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/app/_components/Modal";
import { RuleSetConfig, OFFENCE_TYPES, DEFAULT_GRADE_KEY } from "@/lib/worklog/config";
import { fmtDate, fmt12h, offenceLabel, summarizeLadder } from "@/lib/worklog/format";

type CurrentRuleSet = RuleSetConfig & { id: string; version: number; effectiveFrom: string };

/**
 * Blocks the page it's mounted on until the staff member acknowledges the currently
 * effective rule set. Deliberately NOT mounted on /clock until after clock-in — a
 * rules nag must never be able to delay or block that time-critical action. Fails
 * open on any fetch error/timeout (starts, and stays, unacknowledged=true / ruleSet=null
 * — i.e. renders nothing — unless a definite "not yet acknowledged" response arrives).
 */
export default function RulesAcknowledgementBanner() {
  const [ruleSet, setRuleSet] = useState<CurrentRuleSet | null>(null);
  const [acknowledged, setAcknowledged] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch("/api/worklog/rules/current", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setRuleSet(d.ruleSet);
        setAcknowledged(d.acknowledged);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!ruleSet || acknowledged) return null;

  async function acknowledge() {
    if (!ruleSet) return;
    setSaving(true);
    await fetch(`/api/worklog/rules/${ruleSet.id}/acknowledge`, { method: "POST" });
    setSaving(false);
    setAcknowledged(true);
  }

  return (
    <Modal open onClose={() => {}} dismissible={false} title="Work Update Rules Have Changed">
      <p className="font-mono text-xs text-muted mb-4">Effective {fmtDate(ruleSet.effectiveFrom)}:</p>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink mb-1.5">Slots</p>
      <ul className="font-mono text-xs space-y-1 mb-4">
        {ruleSet.slots.map((s, i) => (
          <li key={i}>
            • {s.label} — due {fmt12h(s.time)}
          </li>
        ))}
      </ul>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink mb-1.5">Offences (per month)</p>
      <ul className="font-mono text-xs space-y-1.5 mb-4">
        {OFFENCE_TYPES.map((t) => {
          const sameForAll = ruleSet.amountsApply === "SAME_FOR_ALL";
          const ladderText = sameForAll
            ? summarizeLadder(ruleSet.tierLadders[DEFAULT_GRADE_KEY]?.[t] ?? [])
            : "Varies by grade";
          return (
            <li key={t}>
              • {offenceLabel(t)} — {ruleSet.warningAllowance[t]} warning{ruleSet.warningAllowance[t] === 1 ? "" : "s"}, then {ladderText}
            </li>
          );
        })}
      </ul>

      <p className="font-mono text-xs text-muted mb-2">Monthly cap: {ruleSet.capPercent}% of salary.</p>
      <p className="font-mono text-xs text-muted mb-4">
        {ruleSet.deductionsEnabled
          ? "Deductions are active this month."
          : "Deductions are currently in warning-only mode — nothing is taken from pay yet."}
      </p>

      <Link href="/worklog/rules" className="font-mono text-xs text-accent hover:underline block mb-5">
        View full rules →
      </Link>

      <button
        onClick={acknowledge}
        disabled={saving}
        className="focus-ring glow-box w-full rounded-md bg-accent hover:bg-accentDim transition-colors py-3 font-mono text-xs uppercase tracking-[0.2em] font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "I understand the rules"}
      </button>
    </Modal>
  );
}
