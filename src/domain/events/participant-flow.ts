import {
  isContributionSlotFilled,
  type ContributionSlot,
} from "@/domain/contributions/slots";
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

/** Best answer across open proposed times: Yes beats Maybe beats No (HUI-003A-T1). */
/** Times the respond flow should list for attendance (confirmed → selected only). */
export function respondAttendanceCandidates(
  candidates: ParticipantTimeCandidate[],
  eventStatus: EventStatus,
): ParticipantTimeCandidate[] {
  if (eventStatus === "confirmed") {
    const selected = candidates.filter((candidate) => candidate.status === "selected");
    if (selected.length > 0) {
      return selected;
    }
  }
  return candidates.filter((candidate) => candidate.status === "proposed");
}

/** Viewer answer for hero/summary: confirmed events use the selected time only. */
export function viewerResponseForDisplay(
  candidates: ParticipantTimeCandidate[],
  eventStatus: EventStatus,
): AvailabilityChoice | null {
  if (eventStatus === "confirmed") {
    const selected = candidates.find((candidate) => candidate.status === "selected");
    return selected?.viewerResponse ?? null;
  }
  const proposed = bestViewerResponseAcrossProposedCandidates(candidates);
  if (proposed !== null) {
    return proposed;
  }
  const focus = pickParticipantTimeCandidate(candidates);
  return focus?.viewerResponse ?? null;
}

export function bestViewerResponseAcrossProposedCandidates(
  candidates: ParticipantTimeCandidate[],
): AvailabilityChoice | null {
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length === 0) {
    return null;
  }
  if (proposed.some((candidate) => candidate.viewerResponse === "available")) {
    return "available";
  }
  if (proposed.some((candidate) => candidate.viewerResponse === "maybe")) {
    return "maybe";
  }
  if (proposed.every((candidate) => candidate.viewerResponse === "unavailable")) {
    return "unavailable";
  }
  return null;
}

export function participantAttendanceBranch(
  choice: AvailabilityChoice,
): "yes-maybe" | "no" {
  return choice === "unavailable" ? "no" : "yes-maybe";
}

export function nextStepAfterAttendanceSave(choice: AvailabilityChoice): ParticipantFlowStep {
  return participantAttendanceBranch(choice) === "no" ? "declined" : "place";
}

/** Bring step only when something is still needed or the viewer already has a claim to review. */
export function shouldShowParticipantBringStep(slots: ContributionSlot[]): boolean {
  if (slots.length === 0) {
    return false;
  }
  if (slots.some((slot) => !isContributionSlotFilled(slot.contribution))) {
    return true;
  }
  return slots.some((slot) => slot.state === "yours" || slot.state === "host");
}

export function nextStepAfterPlace(showBringStep: boolean): ParticipantFlowStep {
  return showBringStep ? "bring" : "done";
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

export function participantFlowStepsForBack(
  from: ParticipantFlowStep,
  options?: { showBringStep?: boolean },
): ParticipantFlowStep | null {
  const showBringStep = options?.showBringStep ?? true;
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
      return showBringStep ? "bring" : "place";
  }
}
