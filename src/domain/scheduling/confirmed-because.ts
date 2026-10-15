import type { ConsensusRule } from "@/domain/scheduling/consensus";
import type { AttendanceCountSummary } from "@/domain/events/who-is-coming";
import { formatWhoIsComingSummary } from "@/domain/events/who-is-coming";

export type EventConfirmationMethod = "consensus" | "organiser";

/** Short confirmed reason from the group's consensus rule (live counts shown separately). */
export function formatConfirmedReasonLine(
  consensusRule: ConsensusRule,
  confirmationMethod?: EventConfirmationMethod | null,
): string {
  if (confirmationMethod === "organiser") {
    return "Confirmed by organiser";
  }
  switch (consensusRule) {
    case "majority_active_members":
      return "Confirmed by majority";
    case "all_active_members":
      return "Confirmed by everyone";
    case "required_participants":
      return "Confirmed by required members";
    case "minimum_attendees":
      return "Confirmed";
  }
}

const REASKING_BASE = "New time proposed · everyone is being asked again";

/** Hero line while a confirmed hui is waiting for fresh answers after a time change (not re-confirmed yet). */
export function formatReaskingHeroStatusLine(input: {
  counts: AttendanceCountSummary | null;
  maybeResponsesEnabled: boolean;
}): string {
  if (!input.counts) {
    return REASKING_BASE;
  }
  if (input.counts.yes === 0 && input.counts.pending > 0) {
    return `${REASKING_BASE} · Awaiting answers`;
  }
  if (input.counts.yes === 0 && input.counts.maybe === 0 && input.counts.no === 0) {
    return `${REASKING_BASE} · Awaiting answers`;
  }
  const attendance = formatWhoIsComingSummary(input.counts, input.maybeResponsesEnabled, {
    eventStatus: "confirmed",
  });
  return `${REASKING_BASE} · ${attendance}`;
}

export function formatConfirmedHeroStatusLine(input: {
  consensusRule: ConsensusRule;
  counts: AttendanceCountSummary | null;
  maybeResponsesEnabled: boolean;
  confirmationMethod?: EventConfirmationMethod | null;
  /** When false, the time is set but consensus is not met again (e.g. after reschedule). */
  consensusCurrentlyPasses?: boolean;
}): string | null {
  if (input.consensusCurrentlyPasses === false) {
    return formatReaskingHeroStatusLine({
      counts: input.counts,
      maybeResponsesEnabled: input.maybeResponsesEnabled,
    });
  }
  const reason = formatConfirmedReasonLine(input.consensusRule, input.confirmationMethod);
  if (!input.counts) {
    return reason;
  }
  if (input.counts.yes === 0 && input.counts.pending > 0) {
    return `${reason} · Awaiting answers`;
  }
  const attendance = formatWhoIsComingSummary(input.counts, input.maybeResponsesEnabled, {
    eventStatus: "confirmed",
  });
  if (input.counts.yes === 0 && input.counts.maybe === 0 && input.counts.no === 0) {
    return `${reason} · Awaiting answers`;
  }
  return `${reason} · ${attendance}`;
}
