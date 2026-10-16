import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/hosts/host-swap-request-form", () => ({
  HostSwapRequestForm: () => <div data-testid="host-swap-form" />,
}));
vi.mock("@/components/events/attendance-live", () => ({
  ViewerResponseCard: () => null,
  LiveGatheringVisual: () => null,
}));

import { EventHeroMeta } from "@/components/events/event-page-sections";
import type { EventDetail } from "@/lib/events/types";
import type { EventPageData } from "@/lib/events/event-page-data";

function buildDetail(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-1",
    groupId: "group-1",
    groupName: "Test group",
    title: "BBQ",
    status: "proposing",
    kind: "one_off",
    location: null,
    locationCoordinates: null,
    foodInvolvement: null,
    hostPlaceRequired: null,
    notes: null,
    startsAt: null,
    endsAt: null,
    timezone: "Pacific/Auckland",
    planningTargetDate: null,
    gatheringType: null,
    gatheringTypeCustom: null,
    createdBy: "creator",
    creatorDisplayName: "Creator",
    recurrenceSeries: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    cancelledAt: null,
    responseDeadlineAt: null,
    lastAvailabilityNudgeAt: null,
    confirmationMethod: null,
    confirmRule: "when_most_can_come",
    viewerRole: "member",
    ...overrides,
  };
}

function buildPageData(overrides: Partial<EventPageData> = {}): EventPageData {
  return {
    group: null,
    settings: null,
    scheduling: { candidates: [], withdrawnCandidates: [], maybeResponsesEnabled: false, minimumAttendees: 2 },
    consensus: {
      confirmRule: "when_most_can_come",
      consensusRule: "majority_active_members",
      minimumAttendees: 2,
      eligibleMemberCount: 3,
      maybeResponsesEnabled: false,
      candidates: [],
    },
    contributionCategories: [],
    eventContributions: [],
    contributionHistory: [],
    sharedDietary: [],
    householdView: null,
    hostContext: {
      assignments: [],
      history: { counts: {}, viewerCount: 0 },
      view: {
        acceptedHost: { userId: "host-user", displayName: "Host Person" },
        pendingProposal: null,
      },
    },
    attendanceRosters: {},
    primaryCandidate: null,
    focusCandidate: null,
    primaryRoster: null,
    displayTimeZone: "Pacific/Auckland",
    viewerResponse: null,
    viewerPrivateNote: null,
    multiTimeAnswerPresentation: null,
    viewerState: "pending",
    counts: null,
    attention: [],
    unclaimedContributionCount: 0,
    claimedContributionCount: 0,
    requestedContributionSlotCount: 0,
    canEdit: false,
    canEditLocation: false,
    canCancel: false,
    canComplete: false,
    canReschedule: false,
    canDelete: false,
    canAccessManage: false,
    canRespond: false,
    canFinalise: false,
    canAdd: false,
    canRemove: false,
    coordinateContributions: false,
    canAssignContributions: false,
    groupMembers: [],
    acceptedHostUserId: "host-user",
    isProposed: true,
    pendingHostProposal: null,
    canAssignHost: false,
    canAcceptHost: false,
    canSwapHost: true,
    hostSwapReplacementAvailable: true,
    showHostSection: true,
    anyCandidatePasses: false,
    organiserPicksConfirm: null,
    viewerHomeLocation: null,
    decisionBundles: [],
    decisionPolls: [],
    canManageDecisions: false,
    canCreateDecisions: false,
    canRespondToDecisions: false,
    openDecisionNeedsResponse: false,
    canEditResponseDeadline: false,
    canNudgeAvailability: false,
    canAdminPickTime: false,
    ...overrides,
  } as EventPageData;
}

describe("EventHeroMeta host swap", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows swap hosting next to host info for the accepted host only", () => {
    render(
      <EventHeroMeta
        detail={buildDetail()}
        userId="host-user"
        pageData={buildPageData()}
        appOrigin="https://example.com"
      />,
    );
    expect(screen.getByTestId("host-swap-form")).toBeInTheDocument();
  });

  it("hides swap hosting for other members", () => {
    render(
      <EventHeroMeta
        detail={buildDetail()}
        userId="other-user"
        pageData={buildPageData({ canSwapHost: false })}
        appOrigin="https://example.com"
      />,
    );
    expect(screen.queryByTestId("host-swap-form")).toBeNull();
  });
});
