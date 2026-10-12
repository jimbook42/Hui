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
  const settingsCadence = cadenceFromGroupSettings(settings);
  const cadence = options.cycle?.cadence ?? settingsCadence;
  const prefill =
    eventKind === "recurring" && options.cycle
      ? proposalPrefillFromCycle(options.cycle, options.groupName)
      : null;

  const anchorFromCadence = cadence?.anchorDate ?? "";
  const cycleTarget = prefill?.planningTargetDate ?? options.cycle?.cycleTargetDate ?? null;
  const prefillStarts = prefill?.startsOn?.trim() ?? "";
  const startsOn =
    (prefillStarts.length > 0 ? prefillStarts : null) ??
    (anchorFromCadence.length > 0 ? anchorFromCadence : null) ??
    cycleTarget ??
    "";
  const intervalUnit = cadence?.intervalUnit ?? "month";
  const intervalCount = cadence?.intervalCount ?? 1;

  return {
    title: "",
    gatheringType: null,
    gatheringTypeCustom: "",
    location: "",
    notes: "",
    eventKind,
    recurrence: {
      seriesTitle: prefill?.seriesTitle ?? (groupHasEstablishedRecurrence(settings) ? options.groupName : ""),
      intervalUnit,
      intervalCount,
      startsOn,
      planningTargetDate: prefill?.planningTargetDate ?? cycleTarget,
    },
    candidates: [],
    initialHostUserId: "suggest",
    foodInvolvement: null,
    hostPlaceRequired: true,
    organiserWillHost: false,
    requestedContributions: [],
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
