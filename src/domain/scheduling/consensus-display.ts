import type { EventConfirmRule } from "@/domain/events/confirm-rule";
import type { EventStatus } from "@/domain/events/types";
import { isSchedulingOpen } from "@/domain/events/lifecycle";

import type { AttendanceRoster } from "./attendance-roster";
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

export function eventConfirmRuleRequirementSummary(
  rule: EventConfirmRule,
  input: {
    minimumAttendees: number;
    eligibleMemberCount: number;
  },
): string {
  switch (rule) {
    case "when_most_can_come":
      return `More than half of active members must say Yes (${input.eligibleMemberCount} members), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
    case "when_everyone_can_come":
      return `Every active member must say Yes (${input.eligibleMemberCount} members), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
    case "organiser_picks":
      return "You confirm the time manually when you are ready (at least one Yes on that time).";
  }
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
    case "majority_active_members":
      return `More than half of active members must say Yes (${input.eligibleMemberCount} members), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
    case "required_participants":
      if (input.requiredParticipantCount === 0) {
        return `${minimumAttendeesRequirementLabel(input.minimumAttendees)} No members are marked as required yet — group admins can set that on the group page.`;
      }
      return `Every member marked as required must be available (${input.requiredParticipantCount} required), with ${minimumAttendeesRequirementLabel(input.minimumAttendees).toLowerCase()}.`;
  }
}

export function consensusMaybeAvailabilityLine(
  rule: ConsensusRule,
  maybeResponsesEnabled: boolean,
): string | null {
  if (!maybeResponsesEnabled) {
    return "Only Yes counts toward the group rules.";
  }
  if (rule === "majority_active_members") {
    return "Maybe can help reach the minimum number needed, but only Yes counts toward the majority.";
  }
  return "Maybe counts as available for the minimum and all-member rules.";
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

export function isWaitingOnHostFailure(
  failureReason: string | null | undefined,
): boolean {
  return failureReason === "waiting_on_host";
}

export function shouldShowFinaliseControl(
  canFinalise: boolean,
  eventStatus: EventStatus,
  candidateStatus: CandidateStatus,
  passes: boolean,
  options?: {
    confirmRule?: EventConfirmRule;
    yesCount?: number;
    failureReason?: string | null;
  },
): boolean {
  if (
    !canFinalise ||
    eventStatus !== "proposing" ||
    candidateStatus !== "proposed" ||
    isWaitingOnHostFailure(options?.failureReason)
  ) {
    return false;
  }
  if (options?.confirmRule === "organiser_picks") {
    return (options.yesCount ?? 0) >= 1;
  }
  return passes;
}

export function eventShowsWaitingOnHost(
  candidates: readonly { failureReason: string | null }[],
): boolean {
  return candidates.some((row) => isWaitingOnHostFailure(row.failureReason));
}

export const WAITING_ON_HOST_STATUS_MESSAGE =
  "Waiting on the host — they need to say Yes to this time before it can be confirmed.";

/** Organiser may attempt manual confirm when at least one Yes is on the table (maybe does not count). */
export function shouldOfferOrganiserConfirm(
  canFinalise: boolean,
  eventStatus: EventStatus,
  candidateStatus: CandidateStatus,
  yesCount: number,
  passes: boolean,
): boolean {
  return (
    canFinalise &&
    eventStatus === "proposing" &&
    candidateStatus === "proposed" &&
    yesCount >= 1 &&
    !passes
  );
}

function acceptedHostBlocksOrganiserConfirm(
  acceptedHostUserId: string | null | undefined,
  roster: AttendanceRoster | undefined,
): boolean {
  if (!acceptedHostUserId) {
    return false;
  }
  const host = roster?.members.find((member) => member.userId === acceptedHostUserId);
  return host?.response !== "yes";
}

/** Organiser-picks hui: manual confirm once the host has said Yes to a proposed time. */
export function organiserPicksCanConfirmNow(
  canFinalise: boolean,
  eventStatus: EventStatus,
  confirmRule: EventConfirmRule | undefined,
  candidates: readonly {
    candidateId: string;
    yesCount: number;
    failureReason: string | null;
  }[],
  proposedCandidateIds: ReadonlySet<string>,
  options?: {
    acceptedHostUserId?: string | null;
    rosterByCandidateId?: ReadonlyMap<string, AttendanceRoster>;
  },
): { candidateId: string } | null {
  if (!canFinalise || eventStatus !== "proposing" || confirmRule !== "organiser_picks") {
    return null;
  }
  const row = candidates.find((candidate) => {
    if (!proposedCandidateIds.has(candidate.candidateId)) {
      return false;
    }
    if (candidate.yesCount < 1 || isWaitingOnHostFailure(candidate.failureReason)) {
      return false;
    }
    const roster = options?.rosterByCandidateId?.get(candidate.candidateId);
    if (
      acceptedHostBlocksOrganiserConfirm(options?.acceptedHostUserId, roster)
    ) {
      return false;
    }
    return true;
  });
  return row ? { candidateId: row.candidateId } : null;
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
