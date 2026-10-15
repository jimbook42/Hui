import {
  isContributionSlotFilled,
  type ContributionSlot,
} from "@/domain/contributions/slots";
import type { MembershipRole } from "@/domain/groups/permissions";
import {
  canAddCandidates,
  canRespondToCandidates,
} from "@/domain/scheduling/permissions";
import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import type { AvailabilityChoice } from "@/domain/scheduling/types";
import type { ParticipantPlaceView } from "@/domain/events/participant-place";
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
> & {
  viewerPrivateNote?: string | null;
};

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

/** Proposed times only — used to pin the multi-time respond list for the whole visit. */
export function proposedAttendanceCandidates(
  candidates: ParticipantTimeCandidate[],
): ParticipantTimeCandidate[] {
  return candidates.filter((candidate) => candidate.status === "proposed");
}

/** True when the member should see one row per proposed time (not the post-confirm single-time UI). */
export function multiTimeRespondSessionActive(
  candidates: ParticipantTimeCandidate[],
  eventStatus: EventStatus,
): boolean {
  return eventStatus !== "confirmed" && proposedAttendanceCandidates(candidates).length > 1;
}

/** Viewer answer for hero/summary: confirmed events use the selected time only. */
/** Private No note for the YOUR ANSWER card (viewer-only). */
export function viewerPrivateNoteForDisplay(
  candidates: ParticipantTimeCandidate[],
  eventStatus: EventStatus,
): string | null {
  const trimmed = (candidate: ParticipantTimeCandidate): string | null => {
    const note = candidate.viewerPrivateNote?.trim();
    return note ? note : null;
  };

  if (eventStatus === "confirmed") {
    const selected = candidates.find((candidate) => candidate.status === "selected");
    return selected ? trimmed(selected) : null;
  }

  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  for (const candidate of proposed) {
    if (candidate.viewerResponse === "unavailable") {
      const note = trimmed(candidate);
      if (note) {
        return note;
      }
    }
  }

  const focus = pickParticipantTimeCandidate(candidates);
  return focus ? trimmed(focus) : null;
}

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

export type MultiTimeViewerAnswerPresentation = {
  summaryLabel: string;
  statusChoice: AvailabilityChoice | null;
  /** Show place/bring follow-up only when every proposed time is yes. */
  showPlaceFollowUp: boolean;
};

/** Multi-time proposing: summarise per-time answers instead of "best" yes across times. */
export function multiTimeProposingAnswerPresentation(
  candidates: ParticipantTimeCandidate[],
  eventStatus: EventStatus,
): MultiTimeViewerAnswerPresentation | null {
  if (eventStatus !== "proposing") {
    return null;
  }
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length <= 1) {
    return null;
  }

  const yesCount = proposed.filter((candidate) => candidate.viewerResponse === "available").length;
  const maybeCount = proposed.filter((candidate) => candidate.viewerResponse === "maybe").length;
  const noCount = proposed.filter((candidate) => candidate.viewerResponse === "unavailable").length;
  const total = proposed.length;

  let summaryLabel = "No answer yet";
  if (yesCount > 0) {
    summaryLabel = `Yes to ${yesCount} of ${total} ${total === 1 ? "time" : "times"}`;
  } else if (maybeCount > 0) {
    summaryLabel = `Maybe for ${maybeCount} of ${total} ${total === 1 ? "time" : "times"}`;
  } else if (noCount > 0 && noCount === proposed.filter((c) => c.viewerResponse !== null).length) {
    summaryLabel = `No to ${noCount} of ${total} ${total === 1 ? "time" : "times"}`;
  } else if (maybeCount === 0 && yesCount === 0 && noCount === 0) {
    summaryLabel = "No answer yet";
  }

  let statusChoice: AvailabilityChoice | null = null;
  if (yesCount === total) {
    statusChoice = "available";
  } else if (maybeCount > 0 && yesCount === 0) {
    statusChoice = "maybe";
  } else if (noCount > 0 && yesCount === 0 && maybeCount === 0) {
    statusChoice = "unavailable";
  }

  return {
    summaryLabel,
    statusChoice,
    showPlaceFollowUp: yesCount === total && total > 0,
  };
}

/** Icon on the event page for mixed multi-time answers (avoid Maybe when summary is Yes to N). */
export function multiTimeViewerVisualState(
  presentation: MultiTimeViewerAnswerPresentation,
): AttendanceVisualState {
  if (presentation.statusChoice === "available") {
    return "yes";
  }
  if (presentation.statusChoice === "maybe") {
    return "maybe";
  }
  if (presentation.statusChoice === "unavailable") {
    return "no";
  }
  if (presentation.summaryLabel.startsWith("Yes to")) {
    return "yes";
  }
  return "pending";
}

export type MultiTimeAnswerDetailRow = {
  candidateId: string;
  timeLabel: string;
  choice: AvailabilityChoice | null;
};

export function multiTimeAnswerDetailRows(
  candidates: ParticipantTimeCandidate[],
  timeLabels: Record<string, string>,
): MultiTimeAnswerDetailRow[] {
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  return proposed.map((candidate) => ({
    candidateId: candidate.id,
    timeLabel: timeLabels[candidate.id]?.trim() || "Time",
    choice: candidate.viewerResponse,
  }));
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

export function shouldShowParticipantPlaceStep(
  placeView: ParticipantPlaceView,
  showBringStep: boolean,
): boolean {
  if (showBringStep) {
    return true;
  }
  return placeView.kind === "known";
}

export function nextStepAfterAttendanceSave(
  choice: AvailabilityChoice,
  options?: { showPlaceStep?: boolean },
): ParticipantFlowStep {
  if (participantAttendanceBranch(choice) === "no") {
    return "declined";
  }
  if (options?.showPlaceStep === false) {
    return "done";
  }
  return "place";
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
