import type { GroupSettingsRow } from "@/lib/groups/types";
import { cadenceFromGroupSettings } from "@/lib/groups/planning-cycle";

import type { EventProposalDraft } from "./proposal";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import { proposalPrefillFromCycle } from "@/domain/recurrence/planning-cycle";

/** Group has configured cadence or an active recurrence series — not a brand-new casual group. */
export function groupHasEstablishedRecurrence(settings: GroupSettingsRow): boolean {
  if (settings.canonicalRecurrenceSeriesId) {
    return true;
  }
  return cadenceFromGroupSettings(settings) !== null;
}

/** Default event kind when proposing from a group. */
export function defaultProposalEventKind(
  settings: GroupSettingsRow,
  context?: { isFirstGroupEvent?: boolean },
): EventProposalDraft["eventKind"] {
  if (context?.isFirstGroupEvent && !groupHasEstablishedRecurrence(settings)) {
    return "one_off";
  }
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
    isFirstGroupEvent?: boolean;
  },
): EventProposalDraft {
  const eventKind = defaultProposalEventKind(settings, {
    isFirstGroupEvent: options.isFirstGroupEvent,
  });
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
