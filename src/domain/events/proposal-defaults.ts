import type { GroupSettingsRow } from "@/lib/groups/types";

import type { EventProposalDraft } from "./proposal";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import { proposalPrefillFromCycle } from "@/domain/recurrence/planning-cycle";

/** Default event kind when proposing from a group — recurring groups favour recurring planning. */
export function defaultProposalEventKind(
  settings: GroupSettingsRow,
): EventProposalDraft["eventKind"] {
  if (settings.recurringEventsEnabled) {
    return "recurring";
  }
  return "one_off";
}

export function buildInitialProposalDraft(
  settings: GroupSettingsRow,
  options: {
    groupName: string;
    cycle: GroupPlanningCycle | null;
  },
): EventProposalDraft {
  const eventKind = defaultProposalEventKind(settings);
  const prefill =
    eventKind === "recurring" && options.cycle
      ? proposalPrefillFromCycle(options.cycle, options.groupName)
      : null;

  return {
    title: "",
    location: "",
    notes: "",
    eventKind,
    recurrence: {
      seriesTitle: prefill?.seriesTitle ?? "",
      intervalUnit: options.cycle?.cadence?.intervalUnit ?? "month",
      intervalCount: options.cycle?.cadence?.intervalCount ?? 1,
      startsOn: prefill?.startsOn ?? options.cycle?.cadence?.anchorDate ?? "",
      planningTargetDate: prefill?.planningTargetDate ?? null,
    },
    candidates: [],
    initialHostUserId: "suggest",
    foodInvolvement: null,
    hostPlaceRequired: true,
  };
}

export function initialCandidateDateFromDraft(
  draft: EventProposalDraft,
  cycle: GroupPlanningCycle | null,
): string {
  if (cycle?.cycleTargetDate && draft.eventKind === "recurring") {
    return cycle.cycleTargetDate;
  }
  return "";
}
