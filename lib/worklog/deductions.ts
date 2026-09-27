import { OffenceType } from "./config";

export type OffenceEvent = {
  type: OffenceType;
  /** Which rule-set version's warningAllowance governs this offence — see spec 7:
   * a mid-period rule change restarts the warning count for the new version. */
  ruleSetId: string;
  warningAllowance: number;
  occurredAt: Date;
};

export type CategorizedOffence = OffenceEvent & { ordinal: number; isWarning: boolean };

/** Ordinal position (1-based) of each offence within its (type, ruleSetId) group,
 * sorted by time, and whether that position falls within the warning allowance.
 * This is the shared primitive the real deduction-amount engine (Phase 5) builds on. */
export function categorizeOffences(offences: OffenceEvent[]): CategorizedOffence[] {
  const sorted = [...offences].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const counts = new Map<string, number>();
  return sorted.map((o) => {
    const key = `${o.type}:${o.ruleSetId}`;
    const ordinal = (counts.get(key) ?? 0) + 1;
    counts.set(key, ordinal);
    return { ...o, ordinal, isWarning: ordinal <= o.warningAllowance };
  });
}

export function countWarnings(offences: OffenceEvent[]): number {
  return categorizeOffences(offences).filter((o) => o.isWarning).length;
}
