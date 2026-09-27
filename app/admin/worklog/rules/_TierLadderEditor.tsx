"use client";

import { OffenceType, TierRow } from "@/lib/worklog/config";

const OFFENCE_LABELS: Record<OffenceType, string> = {
  LATE_CLOCK_IN: "Late clock-in",
  LATE_SUBMISSION: "Late submission",
  MISSED_SUBMISSION: "Missed submission",
  FALSE_SUBMISSION: "False submission",
};

function nairaToKobo(naira: string): number {
  const n = Math.round(parseFloat(naira || "0") * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function koboToNaira(kobo: number): string {
  return (kobo / 100).toString();
}

/** Reassigns fromCount sequentially so gaps/overlaps can't be entered in the first place. */
function recompute(rows: TierRow[]): TierRow[] {
  let next = 1;
  return rows.map((r, i) => {
    const fromCount = next;
    const toCount = i === rows.length - 1 ? r.toCount : r.toCount ?? fromCount;
    next = (toCount ?? fromCount) + 1;
    return { ...r, fromCount, toCount };
  });
}

export default function TierLadderEditor({
  offenceType,
  tiers,
  onChange,
}: {
  offenceType: OffenceType;
  tiers: TierRow[];
  onChange: (rows: TierRow[]) => void;
}) {
  function updateRow(i: number, patch: Partial<TierRow>) {
    onChange(recompute(tiers.map((r, idx) => (idx === i ? { ...r, ...patch } : r))));
  }
  function addRow() {
    const closedPrev = tiers.map((r, idx) =>
      idx === tiers.length - 1 && r.toCount === null ? { ...r, toCount: r.fromCount } : r
    );
    onChange(recompute([...closedPrev, { fromCount: 1, toCount: null, amountKobo: 0 }]));
  }
  function removeRow(i: number) {
    onChange(recompute(tiers.filter((_, idx) => idx !== i)));
  }

  return (
    <div className="border-t border-border pt-3 mt-3 first:mt-0 first:border-0 first:pt-0">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink">{OFFENCE_LABELS[offenceType]}</p>
        <button
          type="button"
          onClick={addRow}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline"
        >
          + Tier
        </button>
      </div>
      {tiers.length === 0 && (
        <p className="font-mono text-[11px] text-muted">No tiers — this offence never costs anything.</p>
      )}
      {tiers.map((row, i) => {
        const isLast = i === tiers.length - 1;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-[11px] text-muted w-16">
              #{row.fromCount}
              {row.toCount !== null && row.toCount !== row.fromCount ? `–${row.toCount}` : ""}
            </span>
            {isLast ? (
              <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={row.toCount === null}
                  onChange={(e) => updateRow(i, { toCount: e.target.checked ? null : row.fromCount })}
                />
                Open-ended
              </label>
            ) : (
              <span className="font-mono text-[11px] text-muted">up to</span>
            )}
            {!(isLast && row.toCount === null) && (
              <input
                type="number"
                min={row.fromCount}
                value={row.toCount ?? row.fromCount}
                onChange={(e) => updateRow(i, { toCount: Math.max(row.fromCount, parseInt(e.target.value || String(row.fromCount))) })}
                className="focus-ring w-20 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
              />
            )}
            <span className="font-mono text-[11px] text-muted">{"₦"}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={koboToNaira(row.amountKobo)}
              onChange={(e) => updateRow(i, { amountKobo: nairaToKobo(e.target.value) })}
              className="focus-ring w-28 rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-bad"
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
