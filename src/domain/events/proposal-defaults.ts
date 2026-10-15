import type { GroupSettingsRow } from "@/lib/groups/types";
import { cadenceFromGroupSettings } from "@/lib/groups/planning-cycle";

import { DEFAULT_EVENT_CONFIRM_RULE } from "@/domain/events/confirm-rule";

import type { EventProposalDraft } from "./proposal";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import {
  pickOpenCycleNominalDate,
  proposalPrefillFromCycle,
} from "@/domain/recurrence/planning-cycle";

type EstablishedRecurrenceContext = {
  isFirstGroupEvent?: boolean;
};

/** Group has configured cadence, an active series, or prior huis on a recurring-enabled group. */
export function groupHasEstablishedRecurrence(
  settings: GroupSettingsRow,
  context?: EstablishedRecurrenceContext,
): boolean {
  if (settings.canonicalRecurrenceSeriesId) {
    return true;
  }
  if (cadenceFromGroupSettings(settings) !== null) {
    return true;
  }
  if (context?.isFirstGroupEvent === false && settings.recurringEventsEnabled) {
    return true;
  }
  return false;
}

/** Default event kind when proposing from a group. */
export function defaultProposalEventKind(
  settings: GroupSettingsRow,
): EventProposalDraft["eventKind"] {
  if (settings.oneOffEventsAllowed) {
    return "one_off";
  }
  if (settings.recurringEventsEnabled) {
    return "recurring";
  }
  return "one_off";
}

/** Recurring draft using the group cadence (for restore / explicit recurring choice). */
export function buildGroupRecurringProposalDraft(
  settings: GroupSettingsRow,
  options: {
    groupName: string;
    cycle: GroupPlanningCycle | null;
    isFirstGroupEvent?: boolean;
    todayDateOnly?: string;
  },
): EventProposalDraft {
  if (!settings.recurringEventsEnabled) {
    return buildInitialProposalDraft(settings, options);
  }
  const forcedSettings: GroupSettingsRow = {
    ...settings,
    oneOffEventsAllowed: false,
  };
  return fillRecurringPlanningDates(
    buildInitialProposalDraft(forcedSettings, options),
  );
}

export function buildInitialProposalDraft(
  settings: GroupSettingsRow,
  options: {
    groupName: string;
    cycle: GroupPlanningCycle | null;
    isFirstGroupEvent?: boolean;
    todayDateOnly?: string;
  },
): EventProposalDraft {
  const eventKind = defaultProposalEventKind(settings);
  const settingsCadence = cadenceFromGroupSettings(settings);
  const cadence = options.cycle?.cadence ?? settingsCadence;
  const prefill =
    eventKind === "recurring" && options.cycle
      ? proposalPrefillFromCycle(options.cycle, options.groupName)
      : null;

  const anchorFromCadence = cadence?.anchorDate ?? "";
  const cycleTarget =
    prefill?.planningTargetDate ??
    (options.cycle ? pickOpenCycleNominalDate(options.cycle) : null);
  const prefillStarts = prefill?.startsOn?.trim() ?? "";
  const startsOn =
    (prefillStarts.length > 0 ? prefillStarts : null) ??
    (anchorFromCadence.length > 0 ? anchorFromCadence : null) ??
    cycleTarget ??
    "";
  const intervalUnit = cadence?.intervalUnit ?? "month";
  const intervalCount = cadence?.intervalCount ?? 1;

  let planningTargetDate = prefill?.planningTargetDate ?? cycleTarget;
  let resolvedStartsOn = startsOn;

  if (
    eventKind === "recurring" &&
    options.isFirstGroupEvent &&
    !groupHasEstablishedRecurrence(settings, {
      isFirstGroupEvent: options.isFirstGroupEvent,
    })
  ) {
    resolvedStartsOn = "";
    planningTargetDate = null;
  }

  const recurrence =
    eventKind === "recurring"
      ? {
          seriesTitle:
            prefill?.seriesTitle ??
            (groupHasEstablishedRecurrence(settings, {
              isFirstGroupEvent: options.isFirstGroupEvent,
            })
              ? options.groupName
              : ""),
          intervalUnit,
          intervalCount,
          startsOn: resolvedStartsOn,
          planningTargetDate,
        }
      : null;

  return fillRecurringPlanningDates({
    title: "",
    gatheringType: null,
    gatheringTypeCustom: "",
    location: "",
    notes: "",
    eventKind,
    recurrence,
    candidates: [],
    initialHostUserId: "suggest",
    foodInvolvement: null,
    hostPlaceRequired: true,
    organiserWillHost: false,
    requestedContributions: [],
    confirmRule: DEFAULT_EVENT_CONFIRM_RULE,
  });
}

/** Ensure recurring drafts always carry a planning target when the cadence anchor or cycle provides one. */
export function fillRecurringPlanningDates(draft: EventProposalDraft): EventProposalDraft {
  if (draft.eventKind !== "recurring" || !draft.recurrence) {
    return draft;
  }
  const fallback =
    draft.recurrence.planningTargetDate?.trim() ||
    draft.recurrence.startsOn?.trim() ||
    "";
  if (!fallback) {
    return draft;
  }
  return {
    ...draft,
    recurrence: {
      ...draft.recurrence,
      planningTargetDate: draft.recurrence.planningTargetDate?.trim() || fallback,
      startsOn: draft.recurrence.startsOn?.trim() || fallback,
    },
  };
}

export function initialCandidateDateFromDraft(
  draft: EventProposalDraft,
  cycle: GroupPlanningCycle | null,
): string {
  if (draft.eventKind === "recurring") {
    if (draft.recurrence?.planningTargetDate) {
      return draft.recurrence.planningTargetDate;
    }
    if (cycle) {
      const open = pickOpenCycleNominalDate(cycle);
      if (open) {
        return open;
      }
    }
  }
  return "";
}
