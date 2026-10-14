import type { ConsensusRule } from "@/domain/scheduling/consensus";
import type { AttendanceCountSummary } from "@/domain/events/who-is-coming";
import { formatWhoIsComingSummary } from "@/domain/events/who-is-coming";

/** Short confirmed reason from the group's consensus rule (live counts shown separately). */
export function formatConfirmedReasonLine(consensusRule: ConsensusRule): string {
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

export function formatConfirmedHeroStatusLine(input: {
  consensusRule: ConsensusRule;
  counts: AttendanceCountSummary | null;
  maybeResponsesEnabled: boolean;
}): string | null {
  const reason = formatConfirmedReasonLine(input.consensusRule);
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
