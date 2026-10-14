import type { EventProposalDraft } from "@/domain/events/proposal";
import {
  cadencePresetFromParts,
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
