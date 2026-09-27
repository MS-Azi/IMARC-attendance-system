"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/_components/Modal";

type CurrentRuleSet = {
  id: string;
  version: number;
  effectiveFrom: string;
  slots: { label: string; time: string }[];
  deductionsEnabled: boolean;
  capPercent: number;
};

/** Blocks the rest of the app until the staff member acknowledges the currently
 * effective rule set. Mounted on every staff-facing worklog page. */
export default function RulesAcknowledgementBanner() {
  const [ruleSet, setRuleSet] = useState<CurrentRuleSet | null>(null);
  const [acknowledged, setAcknowledged] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/worklog/rules/current")
      .then((r) => r.json())
      .then((d) => {
        setRuleSet(d.ruleSet);
        setAcknowledged(d.acknowledged);
      })
      .catch(() => {});
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
      <p className="font-mono text-xs text-muted mb-4">
        Effective {new Date(ruleSet.effectiveFrom).toLocaleDateString()} (version {ruleSet.version}):
      </p>
      <ul className="font-mono text-xs space-y-1 mb-4">
        {ruleSet.slots.map((s, i) => (
          <li key={i}>
            • {s.label} — due {s.time}
          </li>
        ))}
      </ul>
      <p className="font-mono text-xs text-muted mb-5">
        {ruleSet.deductionsEnabled
          ? `Deductions are active this month (capped at ${ruleSet.capPercent}% of salary).`
          : "Deductions are currently in warning-only mode — nothing is taken from pay yet."}
      </p>
      <button
        onClick={acknowledge}
        disabled={saving}
        className="focus-ring glow-box w-full rounded-md bg-accent hover:bg-accentDim transition-colors py-3 font-mono text-xs uppercase tracking-[0.2em] font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "I have read and understood these rules"}
      </button>
    </Modal>
  );
}
