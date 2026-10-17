import { buildDecisionPollView } from "@/domain/decisions/display";
import type { EventPageData } from "@/lib/events/event-page-data";
import type { EventDetail } from "@/lib/events/types";
import type { EventDecisionBundle } from "@/lib/decisions/types";
import type { GroupDetail, GroupSettingsRow } from "@/lib/groups/types";
import type { EventCandidateRow } from "@/lib/scheduling/types";

export const ORGANISER_ID = "organiser-user";
export const MEMBER_ID = "member-user";
export const HOST_ID = "host-user";

export function defaultGroupSettings(): GroupSettingsRow {
  return {
    whoMayPropose: "any_member",
    planningRemindersAudience: "everyone",
    oneOffEventsAllowed: true,
    recurringEventsEnabled: true,
    maybeResponsesEnabled: false,
    minimumAttendees: 2,
    proposalDeadlineHours: 48,
    consensusRule: "majority_active_members",
    adminVetoEnabled: false,
    hostVetoEnabled: false,
    hostingEnabled: true,
    avoidConsecutiveHosts: true,
    timezone: "Pacific/Auckland",
    reconnectRemindersEnabled: false,
    reconnectAfterDays: null,
    recurrenceIntervalUnit: "week",
    recurrenceIntervalCount: 6,
    recurrenceAnchorDate: "2026-01-01",
    planningLeadDays: 14,
    canonicalRecurrenceSeriesId: null,
  };
}

export function buildGroup(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: "group-1",
    name: "Family",
    ownerId: ORGANISER_ID,
    viewerRole: "owner",
    members: [
      {
        userId: ORGANISER_ID,
        displayName: "Organiser",
        role: "owner",
        joinedAt: "2026-01-01T00:00:00.000Z",
        consensusRequired: false,
        hostingStanding: "default",
      },
      {
        userId: MEMBER_ID,
        displayName: "Member",
        role: "member",
        joinedAt: "2026-01-01T00:00:00.000Z",
        consensusRequired: false,
        hostingStanding: "default",
      },
      {
        userId: HOST_ID,
        displayName: "Alex",
        role: "member",
        joinedAt: "2026-01-01T00:00:00.000Z",
        consensusRequired: false,
        hostingStanding: "default",
      },
    ],
    settings: defaultGroupSettings(),
    ...overrides,
  };
}

export function buildCandidate(
  id: string,
  startsAt: string,
  status: EventCandidateRow["status"] = "proposed",
): EventCandidateRow {
  return {
    id,
    startsAt,
    endsAt: null,
    status,
    proposedBy: ORGANISER_ID,
    createdAt: startsAt,
    viewerResponse: null,
    viewerPrivateNote: null,
  };
}

export function buildDetail(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-1",
    groupId: "group-1",
    groupName: "Family",
    title: "Dinner",
    status: "proposing",
    kind: "one_off",
    location: "Home",
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
    createdBy: ORGANISER_ID,
    creatorDisplayName: "Organiser",
    recurrenceSeries: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    cancelledAt: null,
    responseDeadlineAt: null,
    lastAvailabilityNudgeAt: null,
    confirmationMethod: null,
    confirmRule: "when_most_can_come",
    viewerRole: "owner",
    ...overrides,
  };
}

function defaultScheduling(
  candidates: EventCandidateRow[] = [buildCandidate("c1", "2026-12-01T10:00:00.000Z")],
): EventPageData["scheduling"] {
  return {
    candidates,
    withdrawnCandidates: [],
    maybeResponsesEnabled: false,
    minimumAttendees: 2,
    consensusRule: "majority_active_members",
  };
}

export function baseScheduling(): EventPageData["scheduling"] {
  return defaultScheduling();
}

export function buildPageData(overrides: Partial<EventPageData> = {}): EventPageData {
  const group = buildGroup();
  const candidate = buildCandidate("c1", "2026-12-01T10:00:00.000Z");
  return {
    group,
    settings: group.settings,
    scheduling: defaultScheduling([candidate]),
    consensus: {
      confirmRule: "when_most_can_come",
      consensusRule: "majority_active_members",
      minimumAttendees: 2,
      eligibleMemberCount: 3,
      maybeResponsesEnabled: false,
      candidates: [
        {
          candidateId: "c1",
          startsAt: candidate.startsAt,
          endsAt: null,
          passes: false,
          yesCount: 1,
          maybeCount: 0,
          unavailableCount: 0,
          noResponseCount: 2,
          acceptedCount: 1,
          minimumAttendees: 2,
          eligibleMemberCount: 3,
          failureReason: null,
          consensusRule: "majority_active_members",
          requiredParticipantCount: 0,
          requiredAcceptedCount: 0,
          maybeResponsesEnabled: false,
        },
      ],
    },
    contributionCategories: [],
    eventContributions: [],
    contributionHistory: { entries: [], viewerCount: 0 },
    sharedDietary: [],
    householdView: null,
    hostContext: {
      assignments: [],
      history: { entries: [], viewerCount: 0 },
      view: { acceptedHost: null, pendingProposal: null, suggestion: null },
    },
    attendanceRosters: {
      c1: {
        maybeResponsesEnabled: false,
        members: [
          { userId: HOST_ID, displayName: "Alex", response: "yes", submittedLate: false },
        ],
      },
    },
    primaryCandidate: candidate,
    focusCandidate: candidate,
    primaryRoster: null,
    displayTimeZone: "Pacific/Auckland",
    viewerResponse: null,
    viewerPrivateNote: null,
    multiTimeAnswerPresentation: null,
    viewerState: "pending",
    counts: { yes: 1, maybe: 0, no: 0, pending: 2, total: 3 },
    attention: [],
    unclaimedContributionCount: 0,
    claimedContributionCount: 0,
    requestedContributionSlotCount: 0,
    canEdit: true,
    canEditLocation: false,
    canCancel: true,
    canComplete: false,
    canReschedule: false,
    canDelete: true,
    canAccessManage: true,
    canRespond: true,
    canFinalise: true,
    canAdd: true,
    canRemove: true,
    coordinateContributions: false,
    canAssignContributions: false,
    groupMembers: group.members,
    acceptedHostUserId: null,
    isProposed: true,
    pendingHostProposal: null,
    canAssignHost: true,
    canAcceptHost: false,
    canSwapHost: false,
    hostSwapReplacementAvailable: false,
    showHostSection: true,
    anyCandidatePasses: false,
    organiserPicksConfirm: null,
    viewerHomeLocation: null,
    decisionBundles: [],
    decisionPolls: [],
    canManageDecisions: true,
    canCreateDecisions: true,
    canRespondToDecisions: true,
    openDecisionNeedsResponse: false,
    canEditResponseDeadline: true,
    canNudgeAvailability: true,
    canAdminPickTime: false,
    ...overrides,
  } as EventPageData;
}

export function buildDecisionBundle(
  status: "open" | "decided",
  question: string,
): EventDecisionBundle {
  return {
    decision: {
      id: "decision-1",
      eventId: "event-1",
      groupId: "group-1",
      question,
      status,
      createdBy: ORGANISER_ID,
      selectedOptionId: status === "decided" ? "opt-1" : null,
      decidedBy: status === "decided" ? ORGANISER_ID : null,
      decidedAt: status === "decided" ? "2026-10-10T00:00:00.000Z" : null,
      cancelledAt: null,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
    options: [
      { id: "opt-1", decisionId: "decision-1", label: "Cake", position: 0 },
      { id: "opt-2", decisionId: "decision-1", label: "Pie", position: 1 },
    ],
    responses:
      status === "decided"
        ? [{ id: "r1", decisionId: "decision-1", optionId: "opt-1", userId: MEMBER_ID }]
        : [],
  };
}

export function decisionPollsFromBundles(
  bundles: EventDecisionBundle[],
  userId: string,
  members: { userId: string; displayName: string }[],
) {
  return bundles.map((bundle) =>
    buildDecisionPollView({
      id: bundle.decision.id,
      question: bundle.decision.question,
      status: bundle.decision.status,
      options: bundle.options,
      responses: bundle.responses.map((row) => ({
        userId: row.userId,
        optionId: row.optionId,
      })),
      members,
      viewerUserId: userId,
      selectedOptionId: bundle.decision.selectedOptionId,
      decidedByUserId: bundle.decision.decidedBy,
      decidedAt: bundle.decision.decidedAt,
      decidedByName: "Organiser",
      timeZone: "Pacific/Auckland",
    }),
  );
}

export function hostAssignmentSnapshot(
  userId: string,
  displayName: string,
  status: "accepted" | "proposed",
): {
  id: string;
  eventId: string;
  userId: string;
  status: "accepted" | "proposed";
  displayName: string;
  createdAt: string;
} {
  return {
    id: `ha-${userId}`,
    eventId: "event-1",
    userId,
    status,
    displayName,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

export function forView(
  view: "organiser" | "member",
  detail: EventDetail,
  pageData: EventPageData,
): { detail: EventDetail; pageData: EventPageData; userId: string } {
  const userId = view === "organiser" ? ORGANISER_ID : MEMBER_ID;
  return {
    userId,
    detail: {
      ...detail,
      viewerRole: view === "organiser" ? "owner" : "member",
    },
    pageData: {
      ...pageData,
      canAccessManage: view === "organiser" ? pageData.canAccessManage : false,
      canCreateDecisions: view === "organiser" ? pageData.canCreateDecisions : false,
      canManageDecisions: view === "organiser" ? pageData.canManageDecisions : false,
      canCancel: view === "organiser" ? pageData.canCancel : false,
      canDelete: view === "organiser" ? pageData.canDelete : false,
      canFinalise: view === "organiser" ? pageData.canFinalise : false,
      canAdd: view === "organiser" ? pageData.canAdd : false,
      canRemove: view === "organiser" ? pageData.canRemove : false,
      canEdit: view === "organiser" ? pageData.canEdit : false,
      canEditResponseDeadline:
        view === "organiser" ? pageData.canEditResponseDeadline : false,
      canNudgeAvailability: view === "organiser" ? pageData.canNudgeAvailability : false,
      canAdminPickTime: view === "organiser" ? pageData.canAdminPickTime : false,
      canReschedule: view === "organiser" ? pageData.canReschedule : false,
      canAssignHost: view === "organiser" ? pageData.canAssignHost : false,
    },
  };
}
