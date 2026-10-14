import type { EventProposalDraft } from "@/domain/events/proposal";
import {
  cadencePresetFromParts,
  FIRST_GROUP_CADENCE_PRESETS,
  type CadencePresetId,
} from "@/domain/recurrence/cadence-presets";

export type StoredMeetFrequency = null | "once" | CadencePresetId;

export function deriveMeetFrequencyFromDraft(
  draft: EventProposalDraft,
  options: { establishedRecurrence: boolean; isFirstGroupEvent: boolean },
): StoredMeetFrequency {
  if (!options.isFirstGroupEvent || options.establishedRecurrence) {
    if (draft.eventKind === "one_off") {
      return "once";
    }
    if (draft.recurrence) {
      return cadencePresetFromParts(
        draft.recurrence.intervalUnit,
        draft.recurrence.intervalCount,
      );
    }
    return null;
  }
  if (draft.eventKind === "one_off") {
    return "once";
  }
  if (draft.eventKind === "recurring" && draft.recurrence) {
    return cadencePresetFromParts(
      draft.recurrence.intervalUnit,
      draft.recurrence.intervalCount,
    );
  }
  return null;
}

/** Keep persisted draft aligned with the frequency the user picked on step 1. */
export function applyMeetFrequencyToDraft(
  draft: EventProposalDraft,
  meetFrequency: StoredMeetFrequency,
  options: { groupName: string },
): EventProposalDraft {
  if (!meetFrequency || meetFrequency === "once") {
    return {
      ...draft,
      eventKind: "one_off",
      recurrence: null,
    };
  }

  const preset = FIRST_GROUP_CADENCE_PRESETS.find((row) => row.id === meetFrequency);
  if (!preset) {
    return draft;
  }

  return {
    ...draft,
    eventKind: "recurring",
    recurrence: {
      ...(draft.recurrence ?? {
        seriesTitle: "",
        intervalUnit: "month",
        intervalCount: 1,
        startsOn: "",
        planningTargetDate: null,
      }),
      intervalUnit: preset.intervalUnit,
      intervalCount: preset.intervalCount,
      seriesTitle:
        draft.title.trim() ||
        draft.recurrence?.seriesTitle?.trim() ||
        `${options.groupName} gatherings`,
    },
  };
}
