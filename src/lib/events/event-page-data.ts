import "server-only";

import { cache } from "react";

import {
  canAssignEventContributions,
  canCoordinateContributions,
  isProposedEvent,
} from "@/domain/contributions/permissions";
import { buildDecisionPollView, openDecisionsNeedingResponse } from "@/domain/decisions/display";
import {
  canCreateEventDecisions,
  canManageEventDecisions,
  canRespondToEventDecisions,
} from "@/domain/decisions/permissions";
import { buildContributionSlots, isContributionSlotFilled } from "@/domain/contributions/slots";
import { membersHouseholdViewForDisplay } from "@/domain/households/group-display";
import { buildEventAttention } from "@/domain/events/attention";
import { attendanceStateFromChoice } from "@/domain/events/home";
import {
  multiTimeProposingAnswerPresentation,
  pickParticipantTimeCandidate,
  viewerPrivateNoteForDisplay,
  viewerResponseForDisplay,
} from "@/domain/events/participant-flow";
import {
  canAccessEventManagement,
  canCancelEvent,
  canCompleteEvent,
  canRescheduleConfirmedEvent,
  canDeleteEvent,
  canEditEventLocation,
  canEditEventMetadata,
} from "@/domain/events/permissions";
import { pickAcceptedHost, pickPendingHostProposal } from "@/domain/hosts/display";
import {
  canAssignEventHost,
  canRequestHostSwap,
  canRespondToHostProposal,
  canViewHostCoordination,
} from "@/domain/hosts/permissions";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { countAttendance } from "@/domain/scheduling/attendance-visual";
import { organiserPicksCanConfirmNow } from "@/domain/scheduling/consensus-display";
import {
  canAddCandidates,
  canFinaliseEvent,
  canRespondToCandidates,
  canWithdrawCandidate,
} from "@/domain/scheduling/permissions";
import { getServerSupabase } from "@/lib/auth/server-session";
import { fetchMyHomeLocation } from "@/lib/profiles/home-location-query";
import {
  getGroupContributionHistory,
  listContributionCategories,
  listEventContributions,
} from "@/lib/contributions/queries";
import { listEventDecisions } from "@/lib/decisions/queries";
import { listGroupSharedDietary } from "@/lib/dietary/queries";
import type { EventDetail } from "@/lib/events/types";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventHostContext, hostSwapHasReplacement } from "@/lib/hosts/queries";
import { getGroupHouseholdMemberView } from "@/lib/households/queries";
import { devTimed } from "@/lib/perf/dev-server-timing";
import {
  getCandidateAttendanceRoster,
  getEventConsensusSummary,
  getEventSchedulingContext,
} from "@/lib/scheduling/queries";

/**
 * Everything the event page needs beyond the event row itself. Cached per request so the
 * hero, the people section and the details disclosures can each stream independently
 * while sharing one set of parallel queries (HUI-026P).
 *
 * Callers must pass the same `detail` object reference for the cache to hit.
 */
export const loadEventPage = cache(async (detail: EventDetail, userId: string) => {
  const supabase = await getServerSupabase();

  const [
    group,
    scheduling,
    consensus,
    contributionCategories,
    eventContributions,
    contributionHistory,
    sharedDietary,
    decisionBundles,
    viewerHomeLocation,
  ] = await devTimed("event-page:parallel-load", () =>
    Promise.all([
      getGroupDetail(supabase, detail.groupId, userId),
      getEventSchedulingContext(supabase, detail.id, detail.groupId, userId),
      getEventConsensusSummary(supabase, detail.id),
      listContributionCategories(supabase, detail.groupId),
      listEventContributions(supabase, detail.id),
      getGroupContributionHistory(supabase, detail.groupId, userId),
      listGroupSharedDietary(supabase, detail.groupId),
      listEventDecisions(supabase, detail.id),
      fetchMyHomeLocation(supabase, userId),
    ]),
  );

  const [householdViewRaw, hostContext] = await Promise.all([
    group
      ? getGroupHouseholdMemberView(supabase, detail.groupId, group.members)
      : Promise.resolve(null),
    group
      ? getEventHostContext(supabase, detail.id, detail.groupId, userId)
      : Promise.resolve(null),
  ]);

  const householdView =
    group && householdViewRaw
      ? membersHouseholdViewForDisplay(group.members, householdViewRaw)
      : null;

  const settings = group?.settings ?? null;

  const attendanceRosters: Record<string, AttendanceRoster> = {};
  if (scheduling.candidates.length > 0) {
    const rosterRows = await devTimed("event-page:attendance-rosters", () =>
      Promise.all(
        scheduling.candidates.map(async (candidate) => ({
          id: candidate.id,
          roster: await getCandidateAttendanceRoster(supabase, candidate.id),
        })),
      ),
    );
    for (const row of rosterRows) {
      if (row.roster) {
        attendanceRosters[row.id] = row.roster;
      }
    }
  }

  const primary = pickParticipantTimeCandidate(scheduling.candidates);
  const primaryCandidate = primary
    ? (scheduling.candidates.find((candidate) => candidate.id === primary.id) ?? null)
    : null;
  const focusCandidate = primaryCandidate ?? scheduling.candidates[0] ?? null;
  const primaryRoster: AttendanceRoster | null = focusCandidate
    ? (attendanceRosters[focusCandidate.id] ?? null)
    : null;

  const canEdit = canEditEventMetadata(detail.viewerRole, userId, detail.createdBy, detail.status);
  const acceptedHostUserId = hostContext
    ? (pickAcceptedHost(hostContext.assignments)?.userId ?? null)
    : null;
  const canEditLocation = canEditEventLocation(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
    acceptedHostUserId,
  );
  const canCancel = canCancelEvent(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canComplete = canCompleteEvent(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canReschedule = canRescheduleConfirmedEvent(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canDelete = canDeleteEvent(detail.viewerRole, userId, detail.createdBy);
  const canAccessManage = canAccessEventManagement(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
    acceptedHostUserId,
  );
  const canRespond = canRespondToCandidates(detail.status);
  const canFinalise = canFinaliseEvent(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canAdd = settings ? canAddCandidates(detail.viewerRole, settings, detail.status) : false;
  const canRemove = canWithdrawCandidate(detail.viewerRole, userId, detail.createdBy, detail.status);
  const coordinateContributions = canCoordinateContributions(detail.status);
  const canAssignContributions = canAssignEventContributions(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );

  const pendingHostProposal = hostContext ? pickPendingHostProposal(hostContext.assignments) : null;
  const canAssignHost = canAssignEventHost(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canAcceptHost = canRespondToHostProposal(userId, pendingHostProposal, detail.status);
  const canSwapHost = hostContext
    ? canRequestHostSwap(userId, hostContext.assignments, detail.status)
    : false;
  const hostSwapReplacementAvailable =
    canSwapHost && (await hostSwapHasReplacement(supabase, detail.id));
  const showHostSection = canViewHostCoordination(detail.status) && Boolean(settings?.hostingEnabled);

  const displayTimeZone = detail.timezone ?? settings?.timezone ?? "Pacific/Auckland";

  const nowIso = new Date().toISOString();
  const multiTimeAnswerPresentation = multiTimeProposingAnswerPresentation(
    scheduling.candidates,
    detail.status,
    nowIso,
  );
  const viewerResponse = viewerResponseForDisplay(
    scheduling.candidates,
    detail.status,
  );
  const viewerPrivateNote = viewerPrivateNoteForDisplay(
    scheduling.candidates,
    detail.status,
  );
  const viewerState = attendanceStateFromChoice(viewerResponse, scheduling.maybeResponsesEnabled);
  const counts = primaryRoster
    ? countAttendance(primaryRoster.members, scheduling.maybeResponsesEnabled)
    : null;

  const contributionSlots = buildContributionSlots(
    contributionCategories,
    eventContributions,
    userId,
    acceptedHostUserId,
  );
  const unclaimedContributionCount = contributionSlots.filter(
    (slot) => !isContributionSlotFilled(slot.contribution),
  ).length;
  const claimedContributionCount = contributionSlots.filter((slot) =>
    isContributionSlotFilled(slot.contribution),
  ).length;
  const requestedContributionSlotCount = contributionSlots.length;
  const viewerHasContribution = eventContributions.some((row) => row.userId === userId);

  const groupMembers = group?.members ?? [];
  const memberRefs = groupMembers.map((member) => ({
    userId: member.userId,
    displayName: member.displayName,
  }));
  const decisionPolls = decisionBundles.map((bundle) =>
    buildDecisionPollView({
      id: bundle.decision.id,
      question: bundle.decision.question,
      status: bundle.decision.status,
      options: bundle.options,
      responses: bundle.responses.map((row) => ({
        userId: row.userId,
        optionId: row.optionId,
      })),
      members: memberRefs,
      viewerUserId: userId,
      selectedOptionId: bundle.decision.selectedOptionId,
      decidedByUserId: bundle.decision.decidedBy,
      decidedAt: bundle.decision.decidedAt,
      decidedByName:
        groupMembers.find((member) => member.userId === bundle.decision.decidedBy)?.displayName ??
        null,
      timeZone: displayTimeZone,
    }),
  );
  const canRespondToDecisions = canRespondToEventDecisions(detail.status);
  const openDecisionNeedsResponse =
    openDecisionsNeedingResponse(decisionPolls, canRespondToDecisions).length > 0;
  const canManageDecisions = canManageEventDecisions(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canCreateDecisions = canCreateEventDecisions(detail.status);

  const anyCandidatePasses = consensus.candidates.some((candidate) => candidate.passes);
  const proposedIds = new Set(scheduling.candidates.map((row) => row.id));
  const rosterByCandidateId = new Map(
    Object.entries(attendanceRosters).map(([candidateId, roster]) => [candidateId, roster]),
  );
  const organiserPicksConfirm = organiserPicksCanConfirmNow(
    canFinalise,
    detail.status,
    consensus.confirmRule,
    consensus.candidates,
    proposedIds,
    {
      acceptedHostUserId,
      rosterByCandidateId,
    },
  );

  const attention = buildEventAttention({
    status: detail.status,
    hasCandidate: primaryCandidate !== null,
    canRespond,
    viewerResponse,
    canAcceptHostProposal: canAcceptHost,
    canConfirmTime: canFinalise && (anyCandidatePasses || organiserPicksConfirm !== null),
    unclaimedContributionCount,
    canCoordinateContributions: coordinateContributions,
    viewerHasContribution,
    openDecisionNeedsResponse,
    canRespondToDecisions,
  });

  return {
    group,
    settings,
    scheduling,
    consensus,
    contributionCategories,
    eventContributions,
    contributionHistory,
    sharedDietary,
    householdView,
    hostContext,
    attendanceRosters,
    primaryCandidate,
    focusCandidate,
    primaryRoster,
    displayTimeZone,
    viewerResponse,
    viewerPrivateNote,
    multiTimeAnswerPresentation,
    viewerState,
    counts,
    attention,
    unclaimedContributionCount,
    claimedContributionCount,
    requestedContributionSlotCount,
    canEdit,
    canEditLocation,
    canCancel,
    canComplete,
    canReschedule,
    canDelete,
    canAccessManage,
    canRespond,
    canFinalise,
    canAdd,
    canRemove,
    coordinateContributions,
    canAssignContributions,
    groupMembers: group?.members ?? [],
    acceptedHostUserId,
    isProposed: isProposedEvent(detail.status),
    pendingHostProposal,
    canAssignHost,
    canAcceptHost,
    canSwapHost,
    hostSwapReplacementAvailable,
    showHostSection,
    anyCandidatePasses,
    organiserPicksConfirm,
    viewerHomeLocation,
    decisionBundles,
    decisionPolls,
    canManageDecisions,
    canCreateDecisions,
    canRespondToDecisions,
    openDecisionNeedsResponse,
  };
});

export type EventPageData = Awaited<ReturnType<typeof loadEventPage>>;
