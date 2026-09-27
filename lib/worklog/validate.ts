import { OFFENCE_TYPES, OffenceType, RuleSetConfig, SlotConfig, TierRow, DEFAULT_GRADE_KEY } from "./config";
import { parseHHMM, minutesToHHMM } from "./lagos";

export type ValidationResult = { ok: true } | { ok: false; error: string };

export type SlotWindow = {
  slot: SlotConfig;
  opens: number; // minutes since midnight
  onTimeCloses: number;
  lateCloses: number; // next slot's opens, or lastSlotLateCloseTime for the last slot
};

/** Slots sorted by time, with their derived Opens/On-time-closes/Late-closes windows. */
export function computeSlotWindows(config: Pick<RuleSetConfig, "slots" | "lastSlotLateCloseTime">): SlotWindow[] {
  const sorted = [...config.slots].sort((a, b) => parseHHMM(a.time) - parseHHMM(b.time));
  const lastLateCloses = parseHHMM(config.lastSlotLateCloseTime);

  return sorted.map((slot, i) => {
    const t = parseHHMM(slot.time);
    const opens = t - slot.opensBeforeMins;
    const onTimeCloses = t + slot.onTimeAfterMins;
    const lateCloses = i < sorted.length - 1 ? parseHHMM(sorted[i + 1].time) - sorted[i + 1].opensBeforeMins : lastLateCloses;
    return { slot, opens, onTimeCloses, lateCloses };
  });
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// An empty ladder is a legitimate choice — it means this offence type never costs
// anything (deduction engine treats "no matching tier" as amount 0), not an error.
function validateTierLadder(offenceType: OffenceType, tiers: TierRow[]): string | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.fromCount - b.fromCount);
  if (sorted[0].fromCount !== 1) {
    return `${offenceType} tier ladder must start at count 1.`;
  }
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!Number.isInteger(row.fromCount) || row.fromCount < 1) {
      return `${offenceType} tier ladder has an invalid starting count.`;
    }
    if (row.amountKobo < 0 || !Number.isInteger(row.amountKobo)) {
      return `${offenceType} tier amounts must be non-negative whole numbers.`;
    }
    const isLast = i === sorted.length - 1;
    if (row.toCount === null) {
      if (!isLast) return `${offenceType} tier ladder has an open-ended row before its last tier.`;
    } else {
      if (row.toCount < row.fromCount) return `${offenceType} tier ladder has a row where the count range is backwards.`;
      if (!isLast && sorted[i + 1].fromCount !== row.toCount + 1) {
        return `${offenceType} tier ladder has a gap or overlap between tiers.`;
      }
    }
  }
  return null;
}

/** Validates a rule-set config in isolation — no DB access, safe to run on the client too. */
export function validateRuleSetConfig(config: RuleSetConfig): ValidationResult {
  if (!Array.isArray(config.slots) || config.slots.length === 0) {
    return { ok: false, error: "At least one slot is required." };
  }
  for (const slot of config.slots) {
    if (!slot.label?.trim()) return { ok: false, error: "Every slot needs a label." };
    if (!validTime(slot.time)) return { ok: false, error: `Slot "${slot.label}" has an invalid time.` };
    if (!Number.isInteger(slot.opensBeforeMins) || slot.opensBeforeMins < 0) {
      return { ok: false, error: `Slot "${slot.label}"'s opens-before minutes must be 0 or more.` };
    }
    if (!Number.isInteger(slot.onTimeAfterMins) || slot.onTimeAfterMins < 0) {
      return { ok: false, error: `Slot "${slot.label}"'s on-time-after minutes must be 0 or more.` };
    }
  }
  const times = config.slots.map((s) => s.time);
  if (new Set(times).size !== times.length) {
    return { ok: false, error: "Two slots can't have the same time." };
  }
  if (!validTime(config.lastSlotLateCloseTime)) {
    return { ok: false, error: "Last slot's late-close time is invalid." };
  }

  const windows = computeSlotWindows(config);
  for (const w of windows) {
    if (w.opens < 0 || w.opens > 1439) {
      return { ok: false, error: `Slot "${w.slot.label}" opens before midnight — reduce its opens-before minutes.` };
    }
    if (w.onTimeCloses > w.lateCloses) {
      return {
        ok: false,
        error: `Slot "${w.slot.label}"'s on-time window (closes ${minutesToHHMM(w.onTimeCloses)}) runs past when its late window closes (${minutesToHHMM(w.lateCloses)}) — windows overlap.`,
      };
    }
  }
  for (let i = 0; i < windows.length - 1; i++) {
    if (windows[i].lateCloses !== windows[i + 1].opens) {
      // Should be impossible given computeSlotWindows' derivation, but guard anyway.
      return { ok: false, error: `Slots "${windows[i].slot.label}" and "${windows[i + 1].slot.label}" windows overlap.` };
    }
  }
  const last = windows[windows.length - 1];
  if (last.onTimeCloses > parseHHMM(config.lastSlotLateCloseTime)) {
    return { ok: false, error: "The last slot's late-close time must be after its on-time window closes." };
  }

  if (!Array.isArray(config.workingWeekdays) || config.workingWeekdays.length === 0) {
    return { ok: false, error: "At least one working weekday is required." };
  }
  if (config.workingWeekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Working weekdays must be between 0 (Sunday) and 6 (Saturday)." };
  }

  if (!Number.isInteger(config.reminderMinsBefore) || config.reminderMinsBefore < 0) {
    return { ok: false, error: "Reminder minutes-before must be 0 or more." };
  }

  if (config.whatsappMode === "DIRECT") {
    if (!config.adminWhatsappNumber || !/^\d{10,15}$/.test(config.adminWhatsappNumber)) {
      return { ok: false, error: "DIRECT mode needs the admin's WhatsApp number in international format (digits only, e.g. 234...)." };
    }
  } else if (config.whatsappMode !== "GROUP") {
    return { ok: false, error: "WhatsApp mode must be DIRECT or GROUP." };
  }

  if (!Number.isInteger(config.capPercent) || config.capPercent < 0 || config.capPercent > 100) {
    return { ok: false, error: "Monthly cap must be a whole percentage between 0 and 100." };
  }

  for (const t of OFFENCE_TYPES) {
    const allowance = config.warningAllowance[t];
    if (!Number.isInteger(allowance) || allowance < 0) {
      return { ok: false, error: `Warning allowance for ${t} must be 0 or more.` };
    }
  }

  if (config.amountsApply === "BY_GRADE") {
    if (!Array.isArray(config.grades) || config.grades.length === 0) {
      return { ok: false, error: "BY_GRADE needs at least one grade defined." };
    }
    if (new Set(config.grades).size !== config.grades.length) {
      return { ok: false, error: "Grade names must be unique." };
    }
    for (const grade of config.grades) {
      const ladder = config.tierLadders[grade];
      if (!ladder) return { ok: false, error: `No tier ladder configured for grade "${grade}".` };
      for (const t of OFFENCE_TYPES) {
        const err = validateTierLadder(t, ladder[t] ?? []);
        if (err) return { ok: false, error: `[${grade}] ${err}` };
      }
    }
  } else if (config.amountsApply === "SAME_FOR_ALL") {
    const ladder = config.tierLadders[DEFAULT_GRADE_KEY];
    if (!ladder) return { ok: false, error: "No tier ladder configured." };
    for (const t of OFFENCE_TYPES) {
      const err = validateTierLadder(t, ladder[t] ?? []);
      if (err) return { ok: false, error: err };
    }
  } else {
    return { ok: false, error: "amountsApply must be SAME_FOR_ALL or BY_GRADE." };
  }

  return { ok: true };
}
