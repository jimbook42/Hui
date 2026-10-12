import { describe, expect, it } from "vitest";

import {
  buildInitialProposalDraft,
  defaultProposalEventKind,
  groupHasEstablishedRecurrence,
} from "@/domain/events/proposal-defaults";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

function settings(partial: Partial<GroupSettingsRow>): GroupSettingsRow {
  return {
    whoMayPropose: "any_member",
    oneOffEventsAllowed: true,
    recurringEventsEnabled: true,
    hostingEnabled: true,
    timezone: "Pacific/Auckland",
    proposalDeadlineHours: null,
    maybeResponsesEnabled: true,
    minimumAttendees: 1,
    consensusRule: "minimum_attendees",
    adminVetoEnabled: false,
    hostVetoEnabled: false,
    avoidConsecutiveHosts: true,
    reconnectRemindersEnabled: false,
    reconnectAfterDays: null,
    recurrenceIntervalUnit: null,
    recurrenceIntervalCount: null,
    recurrenceAnchorDate: null,
    planningLeadDays: 14,
    canonicalRecurrenceSeriesId: null,
    ...partial,
  };
}

describe("groupHasEstablishedRecurrence", () => {
  it("is false for a new group with recurring enabled but no cadence", () => {
    expect(
      groupHasEstablishedRecurrence(
        settings({ recurringEventsEnabled: true, recurrenceAnchorDate: null }),
      ),
    ).toBe(false);
  });

  it("is true when cadence parts are configured", () => {
    expect(
      groupHasEstablishedRecurrence(
        settings({
          recurrenceIntervalUnit: "month",
          recurrenceIntervalCount: 1,
          recurrenceAnchorDate: "2026-01-15",
        }),
      ),
    ).toBe(true);
  });
});

describe("defaultProposalEventKind", () => {
  it("defaults first hui in a new group to one-off", () => {
    expect(
      defaultProposalEventKind(
        settings({ recurringEventsEnabled: true, oneOffEventsAllowed: true }),
        { isFirstGroupEvent: true },
      ),
    ).toBe("one_off");
  });

  it("prefers recurring when the group has established cadence", () => {
    expect(
      defaultProposalEventKind(
        settings({
          recurringEventsEnabled: true,
          recurrenceIntervalUnit: "month",
          recurrenceIntervalCount: 1,
          recurrenceAnchorDate: "2026-01-15",
        }),
        { isFirstGroupEvent: true },
      ),
    ).toBe("recurring");
  });

  it("prefers recurring on later proposals when recurring is enabled", () => {
    expect(
      defaultProposalEventKind(
        settings({ recurringEventsEnabled: true, oneOffEventsAllowed: true }),
        { isFirstGroupEvent: false },
      ),
    ).toBe("recurring");
  });

  it("falls back to one-off when recurring is disabled", () => {
    expect(
      defaultProposalEventKind(
        settings({ recurringEventsEnabled: false, oneOffEventsAllowed: true }),
      ),
    ).toBe("one_off");
  });
});

describe("buildInitialProposalDraft", () => {
  it("uses the open cycle target when the cadence anchor is missing", () => {
    const cycle: GroupPlanningCycle = {
      cadence: {
        intervalUnit: "month",
        intervalCount: 1,
        anchorDate: "",
      },
      planningLeadDays: 14,
      nextTargetDate: "2026-11-11",
      planningOpensOn: "2026-10-28",
      phase: "ready_to_plan",
      blockingEventId: null,
      cycleTargetDate: "2026-11-11",
    };
    const draft = buildInitialProposalDraft(
      settings({
        recurringEventsEnabled: true,
        recurrenceIntervalUnit: "month",
        recurrenceIntervalCount: 1,
        recurrenceAnchorDate: null,
        canonicalRecurrenceSeriesId: "series-1",
      }),
      { groupName: "QA 002A Group One", cycle, isFirstGroupEvent: false },
    );
    expect(draft.recurrence?.startsOn).toBe("2026-11-11");
    expect(draft.recurrence?.planningTargetDate).toBe("2026-11-11");
  });
});
