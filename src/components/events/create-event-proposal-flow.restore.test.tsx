import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateEventProposalFlow } from "@/components/events/create-event-proposal-flow";
import { groupHasEstablishedRecurrence } from "@/domain/events/proposal-defaults";
import { buildInitialProposalDraft } from "@/domain/events/proposal-defaults";
import {
  readStoredProposalDraft,
  writeStoredProposalDraft,
} from "@/domain/events/proposal-draft-storage";
import type { GroupSettingsRow } from "@/lib/groups/types";

vi.mock("@/app/events/proposal-actions", () => ({
  proposeGroupEventAction: vi.fn(),
}));

vi.mock("@/components/map/event-location-fields", () => ({
  EventLocationFields: () => null,
}));

vi.mock("@/components/events/suggested-times-list", () => ({
  SuggestedTimesList: () => null,
}));

vi.mock("@/components/events/wall-clock-picker-field", () => ({
  WallClockDateField: () => null,
  WallClockTimeField: () => null,
}));

vi.mock("@/components/events/proposal-contribution-request-fields", () => ({
  ProposalContributionRequestFields: () => null,
}));

const freshSettings: GroupSettingsRow = {
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
  recurrenceIntervalUnit: null,
  recurrenceIntervalCount: null,
  recurrenceAnchorDate: null,
  planningLeadDays: 14,
  canonicalRecurrenceSeriesId: null,
};

const establishedSettings: GroupSettingsRow = {
  ...freshSettings,
  recurrenceIntervalUnit: "week",
  recurrenceIntervalCount: 2,
  recurrenceAnchorDate: "2026-10-01",
};

function renderFlow(
  groupId = "group-test",
  options?: { canManageRecurrence?: boolean; isFirstGroupEvent?: boolean; settings?: GroupSettingsRow },
) {
  return render(
    <CreateEventProposalFlow
      groupId={groupId}
      groupName="QA group"
      settings={options?.settings ?? freshSettings}
      isFirstGroupEvent={options?.isFirstGroupEvent ?? true}
      contributionCategories={[]}
      planningCycle={null}
      timeRecommendations={[]}
      canManageRecurrence={options?.canManageRecurrence ?? false}
    />,
  );
}

describe("CreateEventProposalFlow draft restore", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const session = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("confirm", () => true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("restores gathering type and meet frequency from sessionStorage after mount", async () => {
    const groupId = "restore-once";
    const draft = buildInitialProposalDraft(freshSettings, {
      groupName: "QA group",
      cycle: null,
      isFirstGroupEvent: true,
      todayDateOnly: "2026-10-15",
    });
    writeStoredProposalDraft(groupId, {
      step: "name",
      draft: {
        ...draft,
        title: "Saved title",
        gatheringType: "meeting",
        eventKind: "one_off",
        recurrence: null,
      },
      timeDate: "",
      timeStart: "12:00",
      timeEnd: "",
      meetFrequency: "once",
    });

    renderFlow(groupId);

    await waitFor(() => {
      expect(screen.getByLabelText(/Type of hui/i)).toHaveValue("meeting");
    });
    expect(screen.getByLabelText(/Name this hui/i)).toHaveValue("Saved title");
    expect(screen.getByRole("radio", { name: /Just this once/i })).toBeChecked();
  });

  it("restores a recurring cadence preset from sessionStorage", async () => {
    const groupId = "restore-fortnightly";
    const draft = buildInitialProposalDraft(freshSettings, {
      groupName: "QA group",
      cycle: null,
      isFirstGroupEvent: true,
      todayDateOnly: "2026-10-15",
    });
    writeStoredProposalDraft(groupId, {
      step: "name",
      draft: {
        ...draft,
        gatheringType: "dinner_meal",
        eventKind: "recurring",
        recurrence: {
          seriesTitle: "QA group gatherings",
          intervalUnit: "week",
          intervalCount: 2,
          startsOn: "",
          planningTargetDate: null,
        },
      },
      timeDate: "",
      timeStart: "12:00",
      timeEnd: "",
      meetFrequency: "fortnightly",
    });

    renderFlow(groupId);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /Fortnightly/i })).toBeChecked();
    });
  });

  it("shows recurrence link for admins and saves draft on click", async () => {
    const groupId = "recurrence-link";
    const user = userEvent.setup();
    renderFlow(groupId, {
      canManageRecurrence: true,
      isFirstGroupEvent: false,
      settings: establishedSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Change how often you meet/i })).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /Change how often you meet/i });
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    const stored = readStoredProposalDraft(groupId);
    expect(stored?.step).toBeTruthy();
    expect(stored?.draft).toBeTruthy();
  });

  it("hides recurrence link for non-admins on established groups", async () => {
    renderFlow("recurrence-no-link", {
      canManageRecurrence: false,
      isFirstGroupEvent: false,
      settings: establishedSettings,
    });

    await waitFor(() => {
      expect(groupHasEstablishedRecurrence(establishedSettings, { isFirstGroupEvent: false })).toBe(
        true,
      );
    });
    expect(screen.queryByRole("link", { name: /Change how often you meet/i })).toBeNull();
  });

  it("persists one-off event kind when Just this once is selected", async () => {
    const groupId = "persist-once";
    const user = userEvent.setup();
    renderFlow(groupId);

    await waitFor(() => {
      expect(screen.getByLabelText(/Type of hui/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /Monthly/i }));
    await user.click(screen.getByRole("radio", { name: /Just this once/i }));

    await waitFor(() => {
      const stored = readStoredProposalDraft(groupId);
      expect(stored?.meetFrequency).toBe("once");
      expect(stored?.draft.eventKind).toBe("one_off");
      expect(stored?.draft.recurrence).toBeNull();
    });
  });
});
