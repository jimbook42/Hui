export const EVENT_CONFIRM_RULES = [
  "when_most_can_come",
  "when_everyone_can_come",
  "organiser_picks",
] as const;

export type EventConfirmRule = (typeof EVENT_CONFIRM_RULES)[number];

export function isEventConfirmRule(value: string): value is EventConfirmRule {
  return (EVENT_CONFIRM_RULES as readonly string[]).includes(value);
}

export const DEFAULT_EVENT_CONFIRM_RULE: EventConfirmRule = "when_most_can_come";

export function eventConfirmRuleLabel(rule: EventConfirmRule): string {
  switch (rule) {
    case "when_most_can_come":
      return "When most can come";
    case "when_everyone_can_come":
      return "Only when everyone can come";
    case "organiser_picks":
      return "Organiser picks";
  }
}

/** Short line for the hui page, e.g. "Confirms: when most can come". */
export function eventConfirmRuleDisplayLine(rule: EventConfirmRule): string {
  switch (rule) {
    case "when_most_can_come":
      return "Confirms: when most can come";
    case "when_everyone_can_come":
      return "Confirms: only when everyone can come";
    case "organiser_picks":
      return "Confirms: organiser picks the time";
  }
}

export function eventConfirmRuleOptionDescription(rule: EventConfirmRule): string {
  switch (rule) {
    case "when_most_can_come":
      return "Auto-confirm when more than half of the group says Yes (at least two Yes answers).";
    case "when_everyone_can_come":
      return "Auto-confirm only when every active member has said Yes to the same time.";
    case "organiser_picks":
      return "Hui will not auto-confirm. You choose the time when you are ready.";
  }
}
