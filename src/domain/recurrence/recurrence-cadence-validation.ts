import { isDateOnly } from "@/domain/recurrence/date-only";
import type { RecurrenceCadence } from "@/domain/recurrence/planning-cycle";

export type RecurrenceCadenceInput = {
  intervalUnit: string;
  intervalCount: number;
  anchorDate: string;
};

export function parseRecurrenceCadenceInput(input: RecurrenceCadenceInput): {
  cadence: RecurrenceCadence | null;
  error: string | null;
} {
  const unit = input.intervalUnit;
  if (unit !== "week" && unit !== "month") {
    return { cadence: null, error: "Choose weeks or months." };
  }
  if (!Number.isFinite(input.intervalCount) || input.intervalCount < 1 || input.intervalCount > 52) {
    return { cadence: null, error: "Interval must be between 1 and 52." };
  }
  const anchor = input.anchorDate.trim();
  if (!isDateOnly(anchor)) {
    return { cadence: null, error: "Enter a valid anchor date." };
  }
  return {
    cadence: {
      intervalUnit: unit,
      intervalCount: Math.floor(input.intervalCount),
      anchorDate: anchor,
    },
    error: null,
  };
}
