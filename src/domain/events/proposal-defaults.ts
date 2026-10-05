import type { GroupSettingsRow } from "@/lib/groups/types";

import type { EventProposalDraft } from "./proposal";

/** Default event kind when proposing from a group — recurring groups favour recurring planning. */
export function defaultProposalEventKind(
  settings: GroupSettingsRow,
): EventProposalDraft["eventKind"] {
  if (settings.recurringEventsEnabled) {
    return "recurring";
  }
  return "one_off";
}
