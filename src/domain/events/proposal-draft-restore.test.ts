import { describe, expect, it, vi } from "vitest";

import { resolveProposalFlowStateFromClient } from "@/domain/events/proposal-draft-restore";
import { writeStoredProposalDraft } from "@/domain/events/proposal-draft-storage";
import type { GroupSettingsRow } from "@/lib/groups/types";

const establishedSettings: GroupSettingsRow = {
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
  recurrenceIntervalCount: 2,
  recurrenceAnchorDate: "2026-10-01",
  planningLeadDays: 14,
  canonicalRecurrenceSeriesId: "series-1",
};

describe("resolveProposalFlowStateFromClient", () => {
  it("keeps established group cadence when a stale session draft picked monthly", () => {
    const store = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    };
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("window", { sessionStorage });

    writeStoredProposalDraft("group-2", {
      step: "review",
      draft: {
        title: "Second hui",
        gatheringType: "dinner_meal",
        gatheringTypeCustom: "",
        location: "",
        notes: "",
        eventKind: "recurring",
        recurrence: {
          seriesTitle: "QA",
          intervalUnit: "month",
          intervalCount: 1,
          startsOn: "",
          planningTargetDate: null,
        },
        candidates: [],
        initialHostUserId: "suggest",
        foodInvolvement: null,
        hostPlaceRequired: true,
        organiserWillHost: false,
        requestedContributions: [],
        confirmRule: "when_most_can_come",
      },
      timeDate: "",
      timeStart: "12:00",
      timeEnd: "",
      meetFrequency: "monthly",
    });

    const resolved = resolveProposalFlowStateFromClient({
      groupId: "group-2",
      settings: establishedSettings,
      groupName: "Fortnightly dinner",
      planningCycle: null,
      isFirstGroupEvent: false,
      todayDateOnly: "2026-10-15",
    });

    expect(resolved.draft.recurrence?.intervalUnit).toBe("week");
    expect(resolved.draft.recurrence?.intervalCount).toBe(2);
    expect(resolved.draft.recurrence?.startsOn).toBe("2026-10-01");
    expect(resolved.draft.recurrence?.planningTargetDate).toBe("2026-10-01");
    expect(resolved.meetFrequency).toBe("fortnightly");

    vi.unstubAllGlobals();
  });
});
