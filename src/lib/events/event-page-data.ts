import "server-only";

import { cache } from "react";

import {
  canCoordinateContributions,
  isProposedEvent,
} from "@/domain/contributions/permissions";
import { buildEventAttention } from "@/domain/events/attention";
import { attendanceStateFromChoice } from "@/domain/events/home";
import { pickParticipantTimeCandidate } from "@/domain/events/participant-flow";
import { canCancelEvent, canEditEventMetadata } from "@/domain/events/permissions";
import { pickPendingHostProposal } from "@/domain/hosts/display";
import {
  canAssignEventHost,
  canRequestHostSwap,
  canRespondToHostProposal,
  canViewHostCoordination,
} from "@/domain/hosts/permissions";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { countAttendance } from "@/domain/scheduling/attendance-visual";
import {
  canAddCandidates,
  canFinaliseEvent,
  canRespondToCandidates,
  canWithdrawCandidate,
} from "@/domain/scheduling/permissions";
import { getServerSupabase } from "@/lib/auth/server-session";
import {
  getGroupContributionHistory,
  listContributionCategories,
  listEventContributions,
} from "@/lib/contributions/queries";
import { listGroupSharedDietary } from "@/lib/dietary/queries";
import type { EventDetail } from "@/lib/events/types";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventHostContext } from "@/lib/hosts/queries";
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
  ] = await devTimed("event-page:parallel-load", () =>
    Promise.all([
      getGroupDetail(supabase, detail.groupId, userId),
      getEventSchedulingContext(supabase, detail.id, detail.groupId, userId),
      getEventConsensusSummary(supabase, detail.id),
      listContributionCategories(supabase, detail.groupId),
      listEventContributions(supabase, detail.id),
      getGroupContributionHistory(supabase, detail.groupId, userId),
      listGroupSharedDietary(supabase, detail.groupId),
    ]),
  );

  const [householdView, hostContext] = await Promise.all([
    group
      ? getGroupHouseholdMemberView(supabase, detail.groupId, group.members)
      : Promise.resolve(null),
    group
      ? getEventHostContext(supabase, detail.id, detail.groupId, userId)
      : Promise.resolve(null),
  ]);

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
  const canCancel = canCancelEvent(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canRespond = canRespondToCandidates(detail.status);
  const canFinalise = canFinaliseEvent(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canAdd = settings ? canAddCandidates(detail.viewerRole, settings, detail.status) : false;
  const canRemove = canWithdrawCandidate(detail.viewerRole, userId, detail.createdBy, detail.status);
  const coordinateContributions = canCoordinateContributions(detail.status);

  const pendingHostProposal = hostContext ? pickPendingHostProposal(hostContext.assignments) : null;
  const canAssignHost = canAssignEventHost(detail.viewerRole, userId, detail.createdBy, detail.status);
  const canAcceptHost = canRespondToHostProposal(userId, pendingHostProposal, detail.status);
  const canSwapHost = hostContext
    ? canRequestHostSwap(userId, hostContext.assignments, detail.status)
    : false;
  const showHostSection = canViewHostCoordination(detail.status) && Boolean(settings?.hostingEnabled);

  const displayTimeZone = detail.timezone ?? settings?.timezone ?? "Pacific/Auckland";

  const viewerResponse = focusCandidate?.viewerResponse ?? null;
  const viewerState = attendanceStateFromChoice(viewerResponse, scheduling.maybeResponsesEnabled);
  const counts = primaryRoster
    ? countAttendance(primaryRoster.members, scheduling.maybeResponsesEnabled)
    : null;

  const activeCategories = contributionCategories.filter((category) => category.archivedAt === null);
  const claimedCategoryIds = new Set(eventContributions.map((row) => row.categoryId));
  const unclaimedContributionCount = activeCategories.filter(
    (category) => !claimedCategoryIds.has(category.id),
  ).length;
  const viewerHasContribution = eventContributions.some((row) => row.userId === userId);

  const anyCandidatePasses = consensus.candidates.some((candidate) => candidate.passes);

  const attention = buildEventAttention({
    status: detail.status,
    hasCandidate: primaryCandidate !== null,
    canRespond,
    viewerResponse,
    canAcceptHostProposal: canAcceptHost,
    canConfirmTime: canFinalise && anyCandidatePasses,
    unclaimedContributionCount,
    canCoordinateContributions: coordinateContributions,
    viewerHasContribution,
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
    viewerState,
    counts,
    attention,
    unclaimedContributionCount,
    canEdit,
    canCancel,
    canRespond,
    canFinalise,
    canAdd,
    canRemove,
    coordinateContributions,
    isProposed: isProposedEvent(detail.status),
    pendingHostProposal,
    canAssignHost,
    canAcceptHost,
    canSwapHost,
    showHostSection,
    anyCandidatePasses,
  };
});

export type EventPageData = Awaited<ReturnType<typeof loadEventPage>>;
