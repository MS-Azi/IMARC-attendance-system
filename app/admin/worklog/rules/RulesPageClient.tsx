"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/_components/ToastProvider";
import {
  RuleSetConfig,
  OFFENCE_TYPES,
  OffenceType,
  DEFAULT_GRADE_KEY,
  defaultRuleSetConfig,
} from "@/lib/worklog/config";
import { validateRuleSetConfig, computeSlotWindows, labelMatchesTime } from "@/lib/worklog/validate";
import { minutesToHHMM } from "@/lib/worklog/lagos";
import { fmtDate } from "@/lib/worklog/format";
import TierLadderEditor from "./_TierLadderEditor";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OFFENCE_LABELS: Record<OffenceType, string> = {
  LATE_CLOCK_IN: "Late clock-in",
  LATE_SUBMISSION: "Late submission",
  MISSED_SUBMISSION: "Missed submission",
  FALSE_SUBMISSION: "False submission",
};

type RuleSet = {
  id: string;
  version: number;
  effectiveFrom: string;
  appliedImmediately: boolean;
  overrideReason: string | null;
  createdAt: string;
  createdBy?: { email: string };
};

type NonWorkingDay = { id: string; date: string; reason: string };

export default function RulesPageClient() {
  const toast = useToast();
  const [config, setConfig] = useState<RuleSetConfig>(defaultRuleSetConfig());
  const [current, setCurrent] = useState<RuleSet | null>(null);
  const [history, setHistory] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applyImmediately, setApplyImmediately] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [days, setDays] = useState<NonWorkingDay[]>([]);
  const [newDay, setNewDay] = useState({ date: "", reason: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [rulesRes, daysRes] = await Promise.all([
      fetch("/api/admin/worklog/rules"),
      fetch("/api/admin/worklog/non-working-days"),
    ]);
    const rulesData = await rulesRes.json();
    const daysData = await daysRes.json();
    if (rulesData.current) {
      setCurrent(rulesData.current);
      setConfig(rulesData.current.config);
    }
    setHistory(rulesData.history || []);
    setDays(daysData.days || []);
    setLoading(false);
  }

  function patch(p: Partial<RuleSetConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  function ladderFor(grade: string) {
    return config.tierLadders[grade] ?? { LATE_CLOCK_IN: [], LATE_SUBMISSION: [], MISSED_SUBMISSION: [], FALSE_SUBMISSION: [] };
  }
  function setLadderFor(grade: string, offenceType: OffenceType, rows: any) {
    const ladder = { ...ladderFor(grade), [offenceType]: rows };
    patch({ tierLadders: { ...config.tierLadders, [grade]: ladder } });
  }

  async function save() {
    setError(null);
    const validation = validateRuleSetConfig(config);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (applyImmediately && !overrideReason.trim()) {
      setError("A reason is required to apply changes immediately.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/worklog/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config,
        appliedImmediately: applyImmediately,
        overrideReason: applyImmediately ? overrideReason : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      toast(data.error, "error");
      return;
    }
    toast(applyImmediately ? "Rules updated — effective immediately." : "Rules updated — effective next month.");
    setApplyImmediately(false);
    setOverrideReason("");
    load();
  }

  async function addNonWorkingDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDay.date || !newDay.reason.trim()) return;
    const res = await fetch("/api/admin/worklog/non-working-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDay),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    setNewDay({ date: "", reason: "" });
    toast("Non-working day added.");
    load();
  }

  async function removeNonWorkingDay(id: string) {
    await fetch(`/api/admin/worklog/non-working-days/${id}`, { method: "DELETE" });
    toast("Non-working day removed.");
    load();
  }

  if (loading) return <p className="font-mono text-muted text-xs uppercase tracking-[0.15em]">Loading…</p>;

  const windows = (() => {
    try {
      return computeSlotWindows(config);
    } catch {
      return [];
    }
  })();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1">Rules &amp; Deductions</h1>
        <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">
          {current ? `Live version ${current.version}` : "No rules published yet"}
        </p>
      </div>

      {/* Slots and schedule */}
      <Section title="Slots and schedule">
        {config.slots.map((slot, i) => (
          <div key={i} className="mb-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Label">
              <input
                value={slot.label}
                onChange={(e) => {
                  const slots = [...config.slots];
                  slots[i] = { ...slot, label: e.target.value };
                  patch({ slots });
                }}
                className="focus-ring w-24 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={slot.time}
                onChange={(e) => {
                  const slots = [...config.slots];
                  slots[i] = { ...slot, time: e.target.value };
                  patch({ slots });
                }}
                className="focus-ring w-28 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Opens before (min)">
              <input
                type="number"
                min={0}
                value={slot.opensBeforeMins}
                onChange={(e) => {
                  const slots = [...config.slots];
                  slots[i] = { ...slot, opensBeforeMins: parseInt(e.target.value || "0") };
                  patch({ slots });
                }}
                className="focus-ring w-20 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="On-time after (min)">
              <input
                type="number"
                min={0}
                value={slot.onTimeAfterMins}
                onChange={(e) => {
                  const slots = [...config.slots];
                  slots[i] = { ...slot, onTimeAfterMins: parseInt(e.target.value || "0") };
                  patch({ slots });
                }}
                className="focus-ring w-20 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            </Field>
            <button
              type="button"
              onClick={() => patch({ slots: config.slots.filter((_, idx) => idx !== i) })}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-bad pb-1.5"
            >
              Remove
            </button>
          </div>
          {!labelMatchesTime(slot.label, slot.time) && (
            <p className="font-mono text-[11px] text-late mt-1">
              ⚠ Label "{slot.label}" doesn't match its time ({slot.time}) — check this is intentional.
            </p>
          )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ slots: [...config.slots, { label: "", time: "12:00", opensBeforeMins: 30, onTimeAfterMins: 15 }] })}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline mb-4"
        >
          + Slot
        </button>

        {windows.length > 0 && (
          <div className="font-mono text-[11px] text-muted mb-4 space-y-0.5">
            {windows.map((w, i) => (
              <p key={i}>
                {w.slot.label || "(unlabeled)"}: opens {minutesToHHMM(w.opens)} · on-time until {minutesToHHMM(w.onTimeCloses)} · late until{" "}
                {minutesToHHMM(w.lateCloses)}
              </p>
            ))}
          </div>
        )}

        <Field label="Last slot's late-close time">
          <input
            type="time"
            value={config.lastSlotLateCloseTime}
            onChange={(e) => patch({ lastSlotLateCloseTime: e.target.value })}
            className="focus-ring w-28 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
          />
        </Field>

        <div className="mt-4">
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Working weekdays</label>
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_LABELS.map((label, d) => (
              <label key={d} className="flex items-center gap-1.5 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={config.workingWeekdays.includes(d)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...config.workingWeekdays, d]
                      : config.workingWeekdays.filter((x) => x !== d);
                    patch({ workingWeekdays: next.sort() });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* Non-working dates — separate, not versioned */}
      <Section title="Non-working dates">
        <form onSubmit={addNonWorkingDay} className="flex flex-wrap items-end gap-2 mb-4">
          <Field label="Date">
            <input
              type="date"
              value={newDay.date}
              onChange={(e) => setNewDay({ ...newDay, date: e.target.value })}
              className="focus-ring rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Reason">
            <input
              value={newDay.reason}
              onChange={(e) => setNewDay({ ...newDay, reason: e.target.value })}
              placeholder="e.g. Public holiday"
              className="focus-ring rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <button type="submit" className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline pb-1.5">
            Add
          </button>
        </form>
        {days.length === 0 && <p className="font-mono text-[11px] text-muted">No non-working dates set.</p>}
        {days.map((d) => (
          <div key={d.id} className="flex items-center justify-between font-mono text-[11px] py-1 border-b border-border last:border-0">
            <span>
              {fmtDate(d.date)} — {d.reason}
            </span>
            <button onClick={() => removeNonWorkingDay(d.id)} className="text-muted hover:text-bad uppercase tracking-[0.1em]">
              Remove
            </button>
          </div>
        ))}
      </Section>

      {/* Reminders */}
      <Section title="Reminders">
        <Field label="Minutes before slot for 'due soon' push">
          <input
            type="number"
            min={0}
            value={config.reminderMinsBefore}
            onChange={(e) => patch({ reminderMinsBefore: parseInt(e.target.value || "0") })}
            className="focus-ring w-24 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 font-mono text-xs mt-3">
          <input type="checkbox" checked={config.emailOnLate} onChange={(e) => patch({ emailOnLate: e.target.checked })} />
          Email on late (in addition to push)
        </label>
      </Section>

      {/* WhatsApp handoff */}
      <Section title="WhatsApp handoff">
        <div className="flex gap-4 mb-3">
          {(["DIRECT", "GROUP"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5 font-mono text-xs">
              <input type="radio" checked={config.whatsappMode === mode} onChange={() => patch({ whatsappMode: mode })} />
              {mode}
            </label>
          ))}
        </div>
        {config.whatsappMode === "DIRECT" && (
          <Field label="Admin WhatsApp number (international format, digits only, e.g. 234...)">
            <input
              value={config.adminWhatsappNumber ?? ""}
              onChange={(e) => patch({ adminWhatsappNumber: e.target.value.replace(/[^\d]/g, "") })}
              className="focus-ring w-56 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
            />
          </Field>
        )}
      </Section>

      {/* Deductions */}
      <Section title="Deductions">
        <label className="flex items-center gap-2 font-mono text-xs mb-4">
          <input type="checkbox" checked={config.deductionsEnabled} onChange={(e) => patch({ deductionsEnabled: e.target.checked })} />
          Deductions enabled (off = warning-only, shows "would have been" figures)
        </label>

        <label className="flex items-center gap-2 font-mono text-xs mb-4">
          <input type="checkbox" checked={config.staffCanSeeAmounts} onChange={(e) => patch({ staffCanSeeAmounts: e.target.checked })} />
          Staff can see naira amounts
        </label>

        <Field label="Monthly cap (% of salary)">
          <input
            type="number"
            min={0}
            max={100}
            value={config.capPercent}
            onChange={(e) => patch({ capPercent: parseInt(e.target.value || "0") })}
            className="focus-ring w-20 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
          />
        </Field>

        <div className="mt-4">
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-2">Monthly warning allowance</label>
          <div className="grid grid-cols-2 gap-3">
            {OFFENCE_TYPES.map((t) => (
              <Field key={t} label={OFFENCE_LABELS[t]}>
                <input
                  type="number"
                  min={0}
                  value={config.warningAllowance[t]}
                  onChange={(e) =>
                    patch({ warningAllowance: { ...config.warningAllowance, [t]: parseInt(e.target.value || "0") } })
                  }
                  className="focus-ring w-20 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-2">Amounts apply</label>
          <div className="flex gap-4 mb-3">
            {(["SAME_FOR_ALL", "BY_GRADE"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 font-mono text-xs">
                <input
                  type="radio"
                  checked={config.amountsApply === mode}
                  onChange={() => {
                    if (mode === "SAME_FOR_ALL") {
                      patch({ amountsApply: mode, tierLadders: { [DEFAULT_GRADE_KEY]: ladderFor(DEFAULT_GRADE_KEY) } });
                    } else {
                      patch({ amountsApply: mode });
                    }
                  }}
                />
                {mode.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>

        {config.amountsApply === "SAME_FOR_ALL" && (
          <div className="glass rounded-card p-4">
            {OFFENCE_TYPES.map((t) => (
              <TierLadderEditor
                key={t}
                offenceType={t}
                tiers={ladderFor(DEFAULT_GRADE_KEY)[t]}
                onChange={(rows) => setLadderFor(DEFAULT_GRADE_KEY, t, rows)}
              />
            ))}
          </div>
        )}

        {config.amountsApply === "BY_GRADE" && (
          <div className="space-y-4">
            <GradesEditor
              grades={config.grades}
              onChange={(grades) => {
                const tierLadders = { ...config.tierLadders };
                for (const g of grades) if (!tierLadders[g]) tierLadders[g] = ladderFor(g);
                patch({ grades, tierLadders });
              }}
            />
            {config.grades.map((grade) => (
              <div key={grade} className="glass rounded-card p-4">
                <p className="font-mono text-xs uppercase tracking-[0.13em] text-ink mb-3">{grade}</p>
                {OFFENCE_TYPES.map((t) => (
                  <TierLadderEditor
                    key={t}
                    offenceType={t}
                    tiers={ladderFor(grade)[t]}
                    onChange={(rows) => setLadderFor(grade, t, rows)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Effective date */}
      <Section title="Effective date">
        <label className="flex items-center gap-2 font-mono text-xs mb-3">
          <input type="checkbox" checked={applyImmediately} onChange={(e) => setApplyImmediately(e.target.checked)} />
          Apply immediately (default: 1st of next month)
        </label>
        {applyImmediately && (
          <>
            <p className="font-mono text-[11px] text-late mb-2">This changes the rules mid-month — existing offences already recorded keep their original rule-set version.</p>
            <Field label="Reason (required)">
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={2}
                className="focus-ring w-full rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            </Field>
          </>
        )}
      </Section>

      {error && <p className="font-mono text-bad text-xs">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="focus-ring glow-box rounded-md bg-accent hover:bg-accentDim transition-colors px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save rules"}
      </button>

      {/* Version history */}
      <Section title="Version history">
        {history.length === 0 && <p className="font-mono text-[11px] text-muted">No versions published yet.</p>}
        {history.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] py-1.5 border-b border-border last:border-0">
            <span>
              v{v.version} · effective {fmtDate(v.effectiveFrom)}
              {v.appliedImmediately ? " (applied immediately)" : ""} · {v.createdBy?.email ?? "—"}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-card p-4 md:p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function GradesEditor({ grades, onChange }: { grades: string[]; onChange: (grades: string[]) => void }) {
  const [newGrade, setNewGrade] = useState("");
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-2">Grades</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {grades.map((g) => (
          <span key={g} className="glass rounded-md px-2.5 py-1 font-mono text-[11px] flex items-center gap-2">
            {g}
            <button
              type="button"
              onClick={() => onChange(grades.filter((x) => x !== g))}
              className="text-muted hover:text-bad"
              aria-label={`Remove ${g}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newGrade}
          onChange={(e) => setNewGrade(e.target.value)}
          placeholder="e.g. Junior"
          className="focus-ring rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm w-40"
        />
        <button
          type="button"
          onClick={() => {
            if (newGrade.trim() && !grades.includes(newGrade.trim())) {
              onChange([...grades, newGrade.trim()]);
              setNewGrade("");
            }
          }}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline"
        >
          + Grade
        </button>
      </div>
    </div>
  );
}
