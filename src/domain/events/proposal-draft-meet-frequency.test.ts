import { describe, expect, it } from "vitest";

import { applyMeetFrequencyToDraft } from "./proposal-draft-meet-frequency";
import type { EventProposalDraft } from "./proposal";

const baseDraft: EventProposalDraft = {
  title: "Board night",
  gatheringType: "meeting",
  gatheringTypeCustom: "",
  notes: "",
  location: "",
  locationCoordinates: null,
  organiserWillHost: false,
  eventKind: "one_off",
  recurrence: null,
  candidates: [],
  initialHostUserId: "suggest",
  foodInvolvement: null,
  hostPlaceRequired: false,
  requestedContributions: [],
  confirmRule: "when_most_can_come",
};

describe("applyMeetFrequencyToDraft", () => {
  it("keeps custom every-N weeks on the draft", () => {
    const draft = applyMeetFrequencyToDraft(
      {
        ...baseDraft,
        recurrence: {
          seriesTitle: "",
          intervalUnit: "week",
          intervalCount: 5,
          startsOn: "",
          planningTargetDate: null,
        },
      },
      "custom",
      { groupName: "Friends" },
    );
    expect(draft.eventKind).toBe("recurring");
    expect(draft.recurrence?.intervalCount).toBe(5);
    expect(draft.recurrence?.intervalUnit).toBe("week");
  });

  it("keeps custom every-N months on the draft", () => {
    const draft = applyMeetFrequencyToDraft(
      {
        ...baseDraft,
        recurrence: {
          seriesTitle: "",
          intervalUnit: "month",
          intervalCount: 2,
          startsOn: "",
          planningTargetDate: null,
        },
      },
      "custom",
      { groupName: "Friends" },
    );
    expect(draft.recurrence?.intervalCount).toBe(2);
    expect(draft.recurrence?.intervalUnit).toBe("month");
  });
});
