import { describe, expect, it } from "vitest";

import { defaultProposalEventKind } from "@/domain/events/proposal-defaults";
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

describe("defaultProposalEventKind", () => {
  it("prefers recurring when the group allows it", () => {
    expect(
      defaultProposalEventKind(
        settings({ recurringEventsEnabled: true, oneOffEventsAllowed: true }),
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
