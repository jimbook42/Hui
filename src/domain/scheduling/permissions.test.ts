import { describe, expect, it } from "vitest";

import type { GroupSettingsRow } from "@/lib/groups/types";

import {
  canAddCandidates,
  canFinaliseEvent,
  canRespondToCandidates,
  canWithdrawCandidate,
} from "./permissions";

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
  hostingEnabled: true,
  avoidConsecutiveHosts: false,
  timezone: "Pacific/Auckland",
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
    expect(canRespondToCandidates("confirmed")).toBe(false);
    expect(canRespondToCandidates("completed")).toBe(false);
  });

  it("lets the proposer or an admin confirm a proposing event", () => {
    expect(canFinaliseEvent("member", "user-1", "user-1", "proposing")).toBe(true);
    expect(canFinaliseEvent("admin", "user-2", "user-1", "proposing")).toBe(true);
    expect(canFinaliseEvent("member", "user-2", "user-1", "proposing")).toBe(false);
    expect(canFinaliseEvent("owner", "user-2", "user-1", "cancelled")).toBe(false);
    expect(canFinaliseEvent("owner", "user-2", "user-1", "confirmed")).toBe(false);
    expect(canWithdrawCandidate("member", "user-1", "user-1", "confirmed")).toBe(false);
    expect(canAddCandidates("member", baseSettings, "confirmed")).toBe(false);
  });
});
