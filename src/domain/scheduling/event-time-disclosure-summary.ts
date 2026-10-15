import type { EventStatus } from "@/domain/events/types";
import { formatClockTime, formatShortDay } from "@/domain/datetime/display";
import {
  isConfirmedEventReasking,
  REASKING_STATUS_PILL_LABEL,
} from "@/domain/scheduling/confirmed-because";

/** Disclosure summary for the event Time section (manage + details). */
export function formatEventTimeDisclosureSummary(input: {
  status: EventStatus;
  startsAt: string | null;
  timeZone: string;
  consensusCurrentlyPasses?: boolean | null;
  candidateCount: number;
  passingCandidateCount: number;
}): string {
  const tz = input.timeZone;
  if (input.status === "confirmed" && input.startsAt) {
    const prefix = isConfirmedEventReasking(input.status, input.consensusCurrentlyPasses)
      ? REASKING_STATUS_PILL_LABEL
      : "Confirmed";
    return `${prefix} · ${formatShortDay(input.startsAt, tz)} ${formatClockTime(input.startsAt, tz)}`;
  }
  const n = input.candidateCount;
  if (n === 0) {
    return "No times proposed yet";
  }
  const passing = input.passingCandidateCount;
  const times = `${n} ${n === 1 ? "time" : "times"} on the table`;
  return passing > 0 ? `${times} · ${passing} meet${passing === 1 ? "s" : ""} the rules` : times;
}
