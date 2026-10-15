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
  it("defaults to recurring with group cadence and planning date prefilled", () => {
    const resolved = resolveProposalFlowStateFromClient({
      groupId: "group-2",
      settings: establishedSettings,
      groupName: "Fortnightly dinner",
      planningCycle: null,
      isFirstGroupEvent: false,
      todayDateOnly: "2026-10-15",
    });
    expect(resolved.draft.eventKind).toBe("recurring");
    expect(resolved.draft.recurrence?.intervalUnit).toBe("week");
    expect(resolved.draft.recurrence?.intervalCount).toBe(2);
    expect(resolved.draft.recurrence?.planningTargetDate).toBe("2026-10-01");
    expect(resolved.meetFrequency).toBe("fortnightly");
  });

  it("submits with the default recurring draft and group cadence", () => {
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
