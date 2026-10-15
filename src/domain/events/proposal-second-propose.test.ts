import { describe, expect, it } from "vitest";

import { validateEventProposalDraft } from "@/domain/events/proposal";
import { resolveProposalFlowStateFromClient } from "@/domain/events/proposal-draft-restore";
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

describe("second propose on established groups", () => {
  it("defaults to one-off until the creator chooses recurring", () => {
    const resolved = resolveProposalFlowStateFromClient({
      groupId: "group-2",
      settings: establishedSettings,
      groupName: "Fortnightly dinner",
      planningCycle: null,
      isFirstGroupEvent: false,
      todayDateOnly: "2026-10-15",
    });
    expect(resolved.draft.eventKind).toBe("one_off");
    expect(resolved.draft.recurrence).toBeNull();
  });

  it("submits with the group cadence when recurring is chosen", () => {
    const resolved = resolveProposalFlowStateFromClient({
      groupId: "group-2",
      settings: establishedSettings,
      groupName: "Fortnightly dinner",
      planningCycle: null,
      isFirstGroupEvent: false,
      todayDateOnly: "2026-10-15",
    });
    const recurringDraft = {
      ...resolved.draft,
      eventKind: "recurring" as const,
      recurrence: {
        seriesTitle: "Fortnightly dinner",
        intervalUnit: "week" as const,
        intervalCount: 2,
        startsOn: "2026-10-01",
        planningTargetDate: "2026-10-01",
      },
      gatheringType: "dinner_meal" as const,
      foodInvolvement: "unsure" as const,
      candidates: [
        {
          startsAt: "2026-10-26T06:00:00.000Z",
          endsAt: null,
        },
      ],
    };

    const submit = validateEventProposalDraft(recurringDraft, {
      timeZone: "Pacific/Auckland",
      isFirstGroupEvent: false,
      hostingEnabled: true,
      memberUserIds: ["user-a"],
      groupName: "Fortnightly dinner",
    });
    if (!submit.ok) {
      expect(submit.error).toBeUndefined();
    }
    expect(submit.ok).toBe(true);
    if (submit.ok) {
      expect(submit.payload.recurrence?.interval_unit).toBe("week");
      expect(submit.payload.recurrence?.interval_count).toBe(2);
      expect(submit.payload.recurrence?.starts_on).toBe("2026-10-01");
    }
  });
});
