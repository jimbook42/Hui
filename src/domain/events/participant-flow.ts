import type { MembershipRole } from "@/domain/groups/permissions";
import {
  canAddCandidates,
  canRespondToCandidates,
} from "@/domain/scheduling/permissions";
import type { AvailabilityChoice } from "@/domain/scheduling/types";
import type { EventStatus } from "@/domain/events/types";
import type { GroupSettingsRow } from "@/lib/groups/types";
import type { EventCandidateRow } from "@/lib/scheduling/types";

export type ParticipantFlowStep =
  | "time"
  | "declined"
  | "suggest-time"
  | "suggest-done"
  | "place"
  | "bring"
  | "done";

export type ParticipantTimeCandidate = Pick<
  EventCandidateRow,
  "id" | "startsAt" | "endsAt" | "status" | "viewerResponse"
>;

export function pickParticipantTimeCandidate(
  candidates: ParticipantTimeCandidate[],
): ParticipantTimeCandidate | null {
  const selected = candidates.find((c) => c.status === "selected");
  if (selected) {
    return selected;
  }
  const proposed = candidates.filter((c) => c.status === "proposed");
  return proposed[0] ?? null;
}

export function participantAttendanceBranch(
  choice: AvailabilityChoice,
): "yes-maybe" | "no" {
  return choice === "unavailable" ? "no" : "yes-maybe";
}

export function nextStepAfterAttendanceSave(choice: AvailabilityChoice): ParticipantFlowStep {
  return participantAttendanceBranch(choice) === "no" ? "declined" : "place";
}

export function canUseParticipantRespondFlow(input: {
  eventStatus: EventStatus;
  hasCandidate: boolean;
}): boolean {
  if (!canRespondToCandidates(input.eventStatus)) {
    return false;
  }
  return input.hasCandidate;
}

export function canSuggestAlternativeTimeInFlow(
  viewerRole: MembershipRole,
  settings: GroupSettingsRow,
  status: EventStatus,
): boolean {
  return canAddCandidates(viewerRole, settings, status);
}

export function participantFlowStepsForBack(from: ParticipantFlowStep): ParticipantFlowStep | null {
  switch (from) {
    case "time":
      return null;
    case "declined":
      return "time";
    case "suggest-time":
      return "time";
    case "suggest-done":
      return "time";
    case "place":
      return "time";
    case "bring":
      return "place";
    case "done":
      return "bring";
  }
}
