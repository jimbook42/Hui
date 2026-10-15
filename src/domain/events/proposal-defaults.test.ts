import { describe, expect, it } from "vitest";

import {
  buildInitialProposalDraft,
  fillRecurringPlanningDates,
  groupHasEstablishedRecurrence,
  initialCandidateDateFromDraft,
} from "./proposal-defaults";
import type { GroupSettingsRow } from "@/lib/groups/types";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";

const baseSettings: GroupSettingsRow = {
  whoMayPropose: "any_member",
  planningRemindersAudience: "admins_only",
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
  it("treats recurring groups with prior huis as established for propose UX", () => {
    const freshSettings: GroupSettingsRow = {
      ...baseSettings,
      canonicalRecurrenceSeriesId: null,
      recurrenceIntervalUnit: null,
      recurrenceIntervalCount: null,
      recurrenceAnchorDate: null,
    };
    expect(groupHasEstablishedRecurrence(freshSettings, { isFirstGroupEvent: true })).toBe(false);
    expect(groupHasEstablishedRecurrence(freshSettings, { isFirstGroupEvent: false })).toBe(true);
  });

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

  it("mirrors anchor date into planning target for established groups", () => {
    const draft = fillRecurringPlanningDates(
      buildInitialProposalDraft(baseSettings, {
        groupName: "Family",
        cycle: null,
        isFirstGroupEvent: false,
      }),
    );
    expect(draft.recurrence?.startsOn).toBe("2026-09-28");
    expect(draft.recurrence?.planningTargetDate).toBe("2026-09-28");
  });

  it("first group event leaves planning target unset until a time is proposed", () => {
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
    expect(draft.eventKind).toBe("one_off");
    expect(draft.gatheringType).toBeNull();
    expect(draft.recurrence?.planningTargetDate).toBeNull();
    expect(initialCandidateDateFromDraft(draft, null)).toBe("");
  });
});
