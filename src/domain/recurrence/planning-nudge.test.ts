import { describe, expect, it } from "vitest";

import {
  planningCycleNudgeDedupeKey,
  planningCycleNudgeRecipients,
  shouldSendPlanningCycleNudge,
} from "./planning-nudge";
import type { GroupPlanningCycle } from "./planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

const baseSettings: GroupSettingsRow = {
  whoMayPropose: "admins_only",
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
  recurrenceAnchorDate: "2026-10-19",
  planningLeadDays: 14,
  canonicalRecurrenceSeriesId: null,
};

const readyCycle: GroupPlanningCycle = {
  cadence: {
    intervalUnit: "week",
    intervalCount: 1,
    anchorDate: "2026-10-19",
  },
  planningLeadDays: 14,
  nextTargetDate: "2026-10-19",
  planningOpensOn: "2026-10-05",
  phase: "ready_to_plan",
  blockingEventId: null,
  cycleTargetDate: "2026-10-19",
};

describe("planning cycle nudges", () => {
  it("dedupe key is stable per group and nominal date", () => {
    expect(planningCycleNudgeDedupeKey("g1", "2026-10-19")).toBe(
      "planning_cycle_opens:g1:2026-10-19",
    );
  });

  it("sends when ready_to_plan and window is open", () => {
    expect(
      shouldSendPlanningCycleNudge({
        cycle: readyCycle,
        todayDateOnly: "2026-10-06",
        recurrencePaused: false,
      }),
    ).toBe(true);
  });

  it("suppresses when recurrence is paused", () => {
    expect(
      shouldSendPlanningCycleNudge({
        cycle: readyCycle,
        todayDateOnly: "2026-10-06",
        recurrencePaused: true,
      }),
    ).toBe(false);
  });

  it("targets admins only when who_may_propose is admins_only", () => {
    const recipients = planningCycleNudgeRecipients(baseSettings, [
      { userId: "owner", role: "owner" },
      { userId: "admin", role: "admin" },
      { userId: "member", role: "member" },
    ]);
    expect(recipients.sort()).toEqual(["admin", "owner"]);
  });
});
