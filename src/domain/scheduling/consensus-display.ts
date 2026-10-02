import type { EventStatus } from "@/domain/events/types";
import { isSchedulingOpen } from "@/domain/events/lifecycle";

import type { ConsensusRule } from "./consensus";
import type { AvailabilityChoice, CandidateStatus } from "./types";

export type AttendanceCounts = {
  acceptedCount: number;
  maybeCount: number;
  unavailableCount: number;
  noResponseCount: number;
  maybeResponsesEnabled: boolean;
};

/** Aggregate attendance lines for display (no member identities). */
export function buildAttendanceSummaryLines(counts: AttendanceCounts): string[] {
  const lines = [`${counts.acceptedCount} available`];
  if (counts.maybeResponsesEnabled) {
    lines.push(`${counts.maybeCount} maybe`);
  }
  lines.push(`${counts.unavailableCount} unavailable`);
  lines.push(`${counts.noResponseCount} haven't responded`);
  return lines;
}

export function minimumAttendeesRequirementLabel(minimumAttendees: number): string {
  return `Minimum required: ${minimumAttendees}`;
}

export function consensusRuleRequirementSummary(
  rule: ConsensusRule,
  input: {
    minimumAttendees: number;
    eligibleMemberCount: number;
    requiredParticipantCount: number;
  },
): string {
  switch (rule) {
    case "minimum_attendees":
      return minimumAttendeesRequirementLabel(input.minimumAttendees);
    case "all_active_members":
      return `Every active member must be available (${input.eligibleMemberCount} members), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
    case "required_participants":
      if (input.requiredParticipantCount === 0) {
        return `${minimumAttendeesRequirementLabel(input.minimumAttendees)} No members are marked as required yet — group admins can set that on the group page.`;
      }
      return `Every member marked as required must be available (${input.requiredParticipantCount} required), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
  }
}

export function availabilityResponseOptions(
  maybeEnabled: boolean,
): AvailabilityChoice[] {
  const options: AvailabilityChoice[] = ["available", "unavailable"];
  if (maybeEnabled) {
    options.splice(1, 0, "maybe");
  }
  return options;
}

export function isCandidateOpenForResponses(
  eventStatus: EventStatus,
  candidateStatus: CandidateStatus,
): boolean {
  return isSchedulingOpen(eventStatus) && candidateStatus === "proposed";
}

export function shouldShowFinaliseControl(
  canFinalise: boolean,
  eventStatus: EventStatus,
  candidateStatus: CandidateStatus,
  passes: boolean,
): boolean {
  return (
    canFinalise &&
    eventStatus === "proposing" &&
    candidateStatus === "proposed" &&
    passes
  );
}

export function candidateStatusBadge(
  eventStatus: EventStatus,
  candidateStatus: CandidateStatus,
  passes: boolean,
): string | null {
  if (candidateStatus === "withdrawn") {
    return "Withdrawn";
  }
  if (eventStatus === "confirmed" && candidateStatus === "selected") {
    return "Confirmed time";
  }
  if (eventStatus === "confirmed" && candidateStatus === "proposed") {
    return "Not selected";
  }
  if (candidateStatus === "proposed" && passes) {
    return "Meets requirements";
  }
  if (candidateStatus === "proposed") {
    return "Open for responses";
  }
  return null;
}

export function eventSchedulingSectionMessage(
  eventStatus: EventStatus,
  passingCount: number,
  canFinalise: boolean,
): string {
  if (eventStatus === "cancelled") {
    return "This event was cancelled. Availability and candidate changes are closed.";
  }
  if (eventStatus === "confirmed") {
    return "This event is confirmed. Availability and candidate changes are locked.";
  }
  if (eventStatus === "completed") {
    return "This event is completed. Scheduling is closed.";
  }
  if (passingCount > 1) {
    return canFinalise
      ? `${passingCount} times meet the requirements. Choose one to confirm the event. Confirming locks candidate and response changes.`
      : `${passingCount} times meet the requirements. The proposer or a group admin can confirm one of them.`;
  }
  if (passingCount === 1) {
    return canFinalise
      ? "One time meets the requirements. Confirming locks candidate and response changes."
      : "One time meets the requirements. The proposer or a group admin can confirm it.";
  }
  return "No candidate meets the requirements yet. Share your availability while responses are open.";
}

export function proposalDeadlineGroupNotice(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return `This group sets a ${hours}-hour proposal deadline for new gatherings. Hui does not automatically close this event when that window passes.`;
}

export function hasNoResponsesYet(evaluation: AttendanceCounts): boolean {
  const responded =
    evaluation.acceptedCount +
    evaluation.maybeCount +
    evaluation.unavailableCount;
  return responded === 0 && evaluation.noResponseCount > 0;
}
