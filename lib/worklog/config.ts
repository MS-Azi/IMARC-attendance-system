export const OFFENCE_TYPES = [
  "LATE_CLOCK_IN",
  "LATE_SUBMISSION",
  "MISSED_SUBMISSION",
  "FALSE_SUBMISSION",
] as const;
export type OffenceType = (typeof OFFENCE_TYPES)[number];

export type SlotConfig = {
  label: string;
  time: string; // "HH:mm", Lagos
  opensBeforeMins: number;
  onTimeAfterMins: number;
};

export type TierRow = {
  fromCount: number;
  toCount: number | null; // null = open-ended (last tier only)
  amountKobo: number;
};

export type AmountsApply = "SAME_FOR_ALL" | "BY_GRADE";
export type WhatsappMode = "DIRECT" | "GROUP";

/** Key used in tierLadders when amountsApply is SAME_FOR_ALL (no real grade name). */
export const DEFAULT_GRADE_KEY = "__ALL__";

export type TierLadders = Record<string, Record<OffenceType, TierRow[]>>;

export type RuleSetConfig = {
  slots: SlotConfig[];
  lastSlotLateCloseTime: string; // "HH:mm", Lagos
  workingWeekdays: number[]; // 0 = Sunday .. 6 = Saturday
  reminderMinsBefore: number;
  whatsappMode: WhatsappMode;
  adminWhatsappNumber: string | null; // required when whatsappMode === "DIRECT"
  deductionsEnabled: boolean;
  warningAllowance: Record<OffenceType, number>;
  amountsApply: AmountsApply;
  grades: string[]; // only used when amountsApply === "BY_GRADE"
  tierLadders: TierLadders;
  capPercent: number; // 0-100
  staffCanSeeAmounts: boolean;
};

function emptyLadder(): Record<OffenceType, TierRow[]> {
  return { LATE_CLOCK_IN: [], LATE_SUBMISSION: [], MISSED_SUBMISSION: [], FALSE_SUBMISSION: [] };
}

export function defaultRuleSetConfig(): RuleSetConfig {
  return {
    slots: [
      { label: "10AM", time: "10:00", opensBeforeMins: 30, onTimeAfterMins: 15 },
      { label: "12PM", time: "12:00", opensBeforeMins: 30, onTimeAfterMins: 15 },
      { label: "2:30PM", time: "14:30", opensBeforeMins: 30, onTimeAfterMins: 15 },
      { label: "4:30PM", time: "16:30", opensBeforeMins: 30, onTimeAfterMins: 15 },
    ],
    lastSlotLateCloseTime: "17:45",
    workingWeekdays: [1, 2, 3, 4, 5],
    reminderMinsBefore: 15,
    // GROUP needs no pre-entered number, so the unconfigured default validates cleanly;
    // the admin can switch to DIRECT once they've entered a number.
    whatsappMode: "GROUP",
    adminWhatsappNumber: null,
    deductionsEnabled: false,
    warningAllowance: { LATE_CLOCK_IN: 0, LATE_SUBMISSION: 0, MISSED_SUBMISSION: 0, FALSE_SUBMISSION: 0 },
    amountsApply: "SAME_FOR_ALL",
    grades: [],
    tierLadders: { [DEFAULT_GRADE_KEY]: emptyLadder() },
    capPercent: 10,
    staffCanSeeAmounts: false,
  };
}
