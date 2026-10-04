import { describe, expect, it } from "vitest";

import type { GroupSettingsRow } from "@/lib/groups/types";

import {
  canCancelEvent,
  canEditEventLocation,
  canEditEventMetadata,
  canProposeEvents,
  groupAllowsEventKind,
} from "./permissions";

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
};

describe("event permissions", () => {
  it("respects who may propose", () => {
    expect(canProposeEvents("member", baseSettings)).toBe(true);
    expect(
      canProposeEvents("member", { ...baseSettings, whoMayPropose: "admins_only" }),
    ).toBe(false);
    expect(
      canProposeEvents("admin", { ...baseSettings, whoMayPropose: "admins_only" }),
    ).toBe(true);
  });

  it("respects allowed event modes", () => {
    expect(groupAllowsEventKind("one_off", baseSettings)).toBe(true);
    expect(
      groupAllowsEventKind("one_off", { ...baseSettings, oneOffEventsAllowed: false }),
    ).toBe(false);
  });

  it("lets creators and admins cancel active events", () => {
    expect(canCancelEvent("member", "user-1", "user-1", "proposing")).toBe(true);
    expect(canCancelEvent("member", "user-2", "user-1", "proposing")).toBe(false);
    expect(canCancelEvent("admin", "user-2", "user-1", "proposing")).toBe(true);
    expect(canCancelEvent("admin", "user-2", "user-1", "cancelled")).toBe(false);
  });

  it("lets the accepted host edit the place without full metadata rights", () => {
    expect(
      canEditEventLocation("member", "host-user", "creator-user", "proposing", "host-user"),
    ).toBe(true);
    expect(
      canEditEventMetadata("member", "host-user", "creator-user", "proposing"),
    ).toBe(false);
  });
});
