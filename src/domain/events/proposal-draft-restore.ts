import type { EventProposalDraft } from "@/domain/events/proposal";
import {
  buildInitialProposalDraft,
  groupHasEstablishedRecurrence,
  initialCandidateDateFromDraft,
} from "@/domain/events/proposal-defaults";
import { firstGroupCycleNominalDate } from "@/domain/recurrence/first-cycle-nominal";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

import {
  applyMeetFrequencyToDraft,
  deriveMeetFrequencyFromDraft,
  type StoredMeetFrequency,
} from "./proposal-draft-meet-frequency";
import { readStoredProposalCadence, readStoredProposalDraft } from "./proposal-draft-storage";

export type ProposalFlowStep = "name" | "time" | "review";

export type ResolvedProposalFlowState = {
  step: ProposalFlowStep;
  draft: EventProposalDraft;
  timeDate: string;
  timeStart: string;
  timeEnd: string;
  meetFrequency: StoredMeetFrequency;
};

function alignDraftWithMeetFrequency(
  draft: EventProposalDraft,
  meetFrequency: StoredMeetFrequency,
  groupName: string,
): EventProposalDraft {
  if (!meetFrequency) {
    return draft;
  }
  return applyMeetFrequencyToDraft(draft, meetFrequency, { groupName });
}

export function resolveProposalFlowStateFromClient(input: {
  groupId: string;
  settings: GroupSettingsRow;
  groupName: string;
  planningCycle: GroupPlanningCycle | null;
  isFirstGroupEvent: boolean;
  todayDateOnly: string;
}): ResolvedProposalFlowState {
  const initialDraft = buildInitialProposalDraft(input.settings, {
    groupName: input.groupName,
    cycle: input.planningCycle,
    isFirstGroupEvent: input.isFirstGroupEvent,
    todayDateOnly: input.todayDateOnly,
  });
  const initialDate = initialCandidateDateFromDraft(initialDraft, input.planningCycle);
  const establishedRecurrence = groupHasEstablishedRecurrence(input.settings);

  const storedDraft = readStoredProposalDraft(input.groupId);
  if (storedDraft?.draft) {
    const meetFrequency =
      storedDraft.meetFrequency !== undefined
        ? storedDraft.meetFrequency
        : deriveMeetFrequencyFromDraft(storedDraft.draft, {
            establishedRecurrence,
            isFirstGroupEvent: input.isFirstGroupEvent,
          });
    return {
      step: storedDraft.step,
      draft: alignDraftWithMeetFrequency(storedDraft.draft, meetFrequency, input.groupName),
      timeDate: storedDraft.timeDate ?? initialDate,
      timeStart: storedDraft.timeStart ?? "12:00",
      timeEnd: storedDraft.timeEnd ?? "",
      meetFrequency,
    };
  }

  const storedCadence =
    input.isFirstGroupEvent ? readStoredProposalCadence(input.groupId) : null;
  if (storedCadence && !establishedRecurrence) {
    const nominal = firstGroupCycleNominalDate(
      {
        intervalUnit: storedCadence.intervalUnit,
        intervalCount: storedCadence.intervalCount,
      },
      input.todayDateOnly,
    );
    const draft: EventProposalDraft = {
      ...initialDraft,
      eventKind: "recurring",
      recurrence: {
        seriesTitle: initialDraft.recurrence?.seriesTitle ?? "",
        intervalUnit: storedCadence.intervalUnit,
        intervalCount: storedCadence.intervalCount,
        startsOn: nominal,
        planningTargetDate: nominal,
      },
    };
    const meetFrequency = deriveMeetFrequencyFromDraft(draft, {
      establishedRecurrence,
      isFirstGroupEvent: input.isFirstGroupEvent,
    });
    return {
      step: "name",
      draft: alignDraftWithMeetFrequency(draft, meetFrequency, input.groupName),
      timeDate: initialDate,
      timeStart: "12:00",
      timeEnd: "",
      meetFrequency,
    };
  }

  const meetFrequency = deriveMeetFrequencyFromDraft(initialDraft, {
    establishedRecurrence,
    isFirstGroupEvent: input.isFirstGroupEvent,
  });
  return {
    step: "name",
    draft: alignDraftWithMeetFrequency(initialDraft, meetFrequency, input.groupName),
    timeDate: initialDate,
    timeStart: "12:00",
    timeEnd: "",
    meetFrequency,
  };
}
