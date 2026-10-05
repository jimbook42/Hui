import { describe, expect, it } from "vitest";

import {
  defaultProposalEventKind,
  groupHasEstablishedRecurrence,
} from "@/domain/events/proposal-defaults";
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
