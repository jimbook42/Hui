import { describe, expect, it } from "vitest";

import type { EventProposalDraft } from "@/domain/events/proposal";
import {
  applyMeetFrequencyToDraft,
  deriveMeetFrequencyFromDraft,
} from "./proposal-draft-meet-frequency";

const baseDraft = (): EventProposalDraft => ({
  title: "",
  gatheringType: "dinner_meal",
  gatheringTypeCustom: "",
  location: "",
  notes: "",
  eventKind: "one_off",
  recurrence: null,
  candidates: [],
  initialHostUserId: null,
  foodInvolvement: null,
  hostPlaceRequired: true,
  organiserWillHost: false,
  confirmRule: "when_most_can_come",
  requestedContributions: [],
});

describe("deriveMeetFrequencyFromDraft", () => {
  it("restores once vs cadence preset for first-group drafts", () => {
    expect(
      deriveMeetFrequencyFromDraft(baseDraft(), {
        establishedRecurrence: false,
        isFirstGroupEvent: true,
      }),
    ).toBe("once");

    const recurring = {
      ...baseDraft(),
      eventKind: "recurring" as const,
      recurrence: {
        seriesTitle: "",
        intervalUnit: "week" as const,
        intervalCount: 2,
        startsOn: "2026-11-01",
        planningTargetDate: "2026-11-01",
      },
    };
    expect(
      deriveMeetFrequencyFromDraft(recurring, {
        establishedRecurrence: false,
        isFirstGroupEvent: true,
      }),
    ).toBe("fortnightly");
  });

  it("persists once vs recurring cadence on the draft", () => {
    const recurring = applyMeetFrequencyToDraft(baseDraft(), "fortnightly", {
      groupName: "Book club",
    });
    expect(recurring.eventKind).toBe("recurring");
    expect(recurring.recurrence?.intervalUnit).toBe("week");
    expect(recurring.recurrence?.intervalCount).toBe(2);

    const once = applyMeetFrequencyToDraft(recurring, "once", { groupName: "Book club" });
    expect(once.eventKind).toBe("one_off");
    expect(once.recurrence).toBeNull();
  });
});
