import { OffenceType, TierRow, OFFENCE_TYPES } from "./config";
import { OffenceEvent, categorizeOffences } from "./deductions";

export type PayrollOffenceEvent = OffenceEvent & { tiers: TierRow[] };

export function calculateOffenceAmount(ordinal: number, tiers: TierRow[]): number {
  const tier = tiers.find((t) => ordinal >= t.fromCount && (t.toCount === null || ordinal <= t.toCount));
  return tier ? tier.amountKobo : 0; // no matching tier (ladder shorter than actual count) -> 0, not an error
}

export type PayrollBreakdown = {
  subtotals: Record<OffenceType, number>; // kobo
  totalBeforeCapKobo: number;
  capKobo: number;
  totalDeductionKobo: number;
  capped: boolean;
  netKobo: number;
};

function emptySubtotals(): Record<OffenceType, number> {
  return { LATE_CLOCK_IN: 0, LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 };
}

/**
 * Section 7 of the spec, verbatim: warning-allowance-first, then tier amount by
 * ordinal position — restarting per rule-set version (categorizeOffences already
 * groups by (type, ruleSetId), so a mid-month "apply immediately" split falls out of
 * that for free, each offence using its own version's warningAllowance/tiers via the
 * `tiers` field the caller resolved onto it).
 */
export function calculatePayroll(
  offences: PayrollOffenceEvent[],
  salaryKobo: number,
  capPercent: number,
  deductionsEnabled: boolean
): PayrollBreakdown {
  const subtotals = emptySubtotals();
  for (const c of categorizeOffences(offences)) {
    if (c.isWarning) continue;
    subtotals[c.type] += calculateOffenceAmount(c.ordinal, c.tiers);
  }

  const totalBeforeCapKobo = OFFENCE_TYPES.reduce((sum, t) => sum + subtotals[t], 0);
  const capKobo = Math.floor((salaryKobo * capPercent) / 100);
  const totalDeductionKobo = Math.min(totalBeforeCapKobo, capKobo);
  const capped = totalBeforeCapKobo > capKobo;
  const netKobo = salaryKobo - (deductionsEnabled ? totalDeductionKobo : 0);

  return { subtotals, totalBeforeCapKobo, capKobo, totalDeductionKobo, capped, netKobo };
}
