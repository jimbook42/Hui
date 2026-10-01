import { describe, expect, it } from "vitest";

import type { GroupSettingsRow } from "@/lib/groups/types";

import { canAddCandidates, canRespondToCandidates } from "./permissions";

const baseSettings: GroupSettingsRow = {
  whoMayPropose: "any_member",
  oneOffEventsAllowed: true,
  recurringEventsEnabled: true,
  maybeResponsesEnabled: true,
  minimumAttendees: 3,
  proposalDeadlineHours: null,
  consensusRule: "minimum_attendees",
  adminVetoEnabled: false,
  hostVetoEnabled: false,
  reconnectRemindersEnabled: false,
  reconnectAfterDays: null,
};

describe("scheduling permissions", () => {
  it("lets proposers add candidates while the event is open", () => {
    expect(canAddCandidates("member", baseSettings, "proposing")).toBe(true);
    expect(
      canAddCandidates("member", { ...baseSettings, whoMayPropose: "admins_only" }, "proposing"),
    ).toBe(false);
    expect(canAddCandidates("member", baseSettings, "cancelled")).toBe(false);
  });

  it("lets members respond while the event accepts scheduling input", () => {
    expect(canRespondToCandidates("proposing")).toBe(true);
    expect(canRespondToCandidates("completed")).toBe(false);
  });
});
