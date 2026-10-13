import { describe, expect, it } from "vitest";

import { buildInitialProposalDraft, initialCandidateDateFromDraft } from "./proposal-defaults";
import type { GroupSettingsRow } from "@/lib/groups/types";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";

const baseSettings: GroupSettingsRow = {
  whoMayPropose: "any_member",
  oneOffEventsAllowed: true,
  recurringEventsEnabled: true,
  maybeResponsesEnabled: true,
  minimumAttendees: 1,
  proposalDeadlineHours: null,
  consensusRule: "required_participants",
  adminVetoEnabled: false,
  hostVetoEnabled: false,
  hostingEnabled: true,
  avoidConsecutiveHosts: false,
  timezone: "Pacific/Auckland",
  reconnectRemindersEnabled: false,
  reconnectAfterDays: null,
  recurrenceIntervalUnit: "week",
  recurrenceIntervalCount: 1,
  recurrenceAnchorDate: "2026-09-28",
  planningLeadDays: 14,
  canonicalRecurrenceSeriesId: "series-1",
};

describe("proposal defaults (HUI-031 tier-2)", () => {
  it("6: prefill uses next open nominal, not a past completed cycle", () => {
    const cycle: GroupPlanningCycle = {
      cadence: {
        intervalUnit: "week",
        intervalCount: 1,
        anchorDate: "2026-09-28",
      },
      planningLeadDays: 14,
      nextTargetDate: "2026-10-26",
      planningOpensOn: "2026-10-12",
      phase: "ready_to_plan",
      blockingEventId: null,
      cycleTargetDate: "2026-10-19",
    };

    const draft = buildInitialProposalDraft(baseSettings, {
      groupName: "Family",
      cycle,
      isFirstGroupEvent: false,
    });
    expect(draft.recurrence?.planningTargetDate).toBe("2026-10-26");
    expect(initialCandidateDateFromDraft(draft, cycle)).toBe("2026-10-26");
  });

  it("first group event with recurring enabled pre-fills first nominal target", () => {
    const freshSettings: GroupSettingsRow = {
      ...baseSettings,
      canonicalRecurrenceSeriesId: null,
      recurrenceIntervalUnit: null,
      recurrenceIntervalCount: null,
      recurrenceAnchorDate: null,
    };
    const draft = buildInitialProposalDraft(freshSettings, {
      groupName: "New group",
      cycle: null,
      isFirstGroupEvent: true,
      todayDateOnly: "2026-10-13",
    });
    expect(draft.eventKind).toBe("recurring");
    expect(draft.recurrence?.startsOn).toBe("2026-10-13");
    expect(draft.recurrence?.planningTargetDate).toBe("2026-11-13");
    expect(initialCandidateDateFromDraft(draft, null)).toBe("2026-11-13");
  });
});
