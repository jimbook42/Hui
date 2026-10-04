import Link from "next/link";

import { updateEventAction } from "@/app/events/actions";
import { EventDetailManagement } from "@/components/events/event-detail-management";
import { EventDetailSummary } from "@/components/events/event-detail-summary";
import { EventParticipantsSummary } from "@/components/events/event-participants-summary";
import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { EventDietarySection } from "@/components/dietary/event-dietary-section";
import { EventHostSection } from "@/components/hosts/event-host-section";
import {
  canCoordinateContributions,
  isProposedEvent,
} from "@/domain/contributions/permissions";
import { getEventHostContext } from "@/lib/hosts/queries";
import { listGroupSharedDietary } from "@/lib/dietary/queries";
import { EventScheduling } from "@/components/events/event-scheduling";
import {
  canAssignEventHost,
  canRequestHostSwap,
  canRespondToHostProposal,
  canViewHostCoordination,
} from "@/domain/hosts/permissions";
import { pickPendingHostProposal } from "@/domain/hosts/display";
import {
  getGroupContributionHistory,
  listContributionCategories,
  listEventContributions,
} from "@/lib/contributions/queries";
import {
  canCancelEvent,
  canEditEventMetadata,
} from "@/domain/events/permissions";
import {
  canAddCandidates,
  canFinaliseEvent,
  canRespondToCandidates,
  canWithdrawCandidate,
} from "@/domain/scheduling/permissions";
import type { EventDetail } from "@/lib/events/types";
import { participantRespondPath } from "@/lib/events/paths";
import { getGroupDetail } from "@/lib/groups/queries";
import { getGroupHouseholdMemberView } from "@/lib/households/queries";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  getCandidateAttendanceRoster,
  getEventConsensusSummary,
  getEventSchedulingContext,
} from "@/lib/scheduling/queries";
import { devTimed } from "@/lib/perf/dev-server-timing";
import { createClient } from "@/lib/supabase/server";

type EventDetailHeavySectionsProps = {
  detail: EventDetail;
  userId: string;
  formatWhen: (
    startsAt: string | null,
    endsAt: string | null,
    timeZone: string,
  ) => string;
};

export async function EventDetailHeavySections({
  detail,
  userId,
  formatWhen,
}: EventDetailHeavySectionsProps) {
  const supabase = await createClient();

  const canEdit = canEditEventMetadata(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canCancel = canCancelEvent(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );

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

  const canCoordinate = canCoordinateContributions(detail.status);
  const settings = group?.settings;
  const showScheduling = Boolean(settings);
  const canAdd = settings
    ? canAddCandidates(detail.viewerRole, settings, detail.status)
    : false;
  const canRemove = canWithdrawCandidate(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canRespond = canRespondToCandidates(detail.status);
  const canFinalise = canFinaliseEvent(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const pendingHostProposal = hostContext
    ? pickPendingHostProposal(hostContext.assignments)
    : null;
  const canAssignHost = canAssignEventHost(
    detail.viewerRole,
    userId,
    detail.createdBy,
    detail.status,
  );
  const canRespondHost = canRespondToHostProposal(
    userId,
    pendingHostProposal,
    detail.status,
  );
  const canRequestHostSwapAction = hostContext
    ? canRequestHostSwap(userId, hostContext.assignments, detail.status)
    : false;
  const showHostSection =
    canViewHostCoordination(detail.status) && Boolean(settings?.hostingEnabled);
  const displayTimeZone =
    detail.timezone ?? settings?.timezone ?? "Pacific/Auckland";

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
  const primaryAttendanceRoster: AttendanceRoster | null =
    scheduling.candidates.length > 0
      ? (attendanceRosters[scheduling.candidates[0].id] ?? null)
      : null;

  return (
    <>
      {canRespond && scheduling.candidates.length > 0 ? (
        <div className="mt-6">
          <Link
            href={participantRespondPath(detail.id)}
            className="inline-flex w-full max-w-md items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Respond to this event
          </Link>
          <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Answer attendance, place, and contributions in a short mobile-friendly flow.
          </p>
        </div>
      ) : null}

      <EventDetailSummary
        detail={detail}
        displayTimeZone={displayTimeZone}
        formatWhen={formatWhen}
      />

      {showScheduling ? (
        <EventScheduling
          eventId={detail.id}
          groupId={detail.groupId}
          eventStatus={detail.status}
          candidates={scheduling.candidates}
          withdrawnCandidates={scheduling.withdrawnCandidates}
          maybeResponsesEnabled={scheduling.maybeResponsesEnabled}
          minimumAttendees={scheduling.minimumAttendees}
          proposalDeadlineHours={settings?.proposalDeadlineHours ?? null}
          consensus={consensus}
          canAddCandidates={canAdd}
          canRemoveCandidates={canRemove}
          canRespond={canRespond}
          canFinalise={canFinalise}
          timeZone={displayTimeZone}
          attendanceRosters={attendanceRosters}
        />
      ) : null}

      {householdView && settings ? (
        <EventParticipantsSummary
          view={householdView}
          eligibleMemberCount={consensus.eligibleMemberCount}
        />
      ) : null}

      {showHostSection && hostContext && group && settings ? (
        <EventHostSection
          eventId={detail.id}
          groupId={detail.groupId}
          eventStatus={detail.status}
          hostingEnabled={settings.hostingEnabled}
          canAssign={canAssignHost}
          canRespond={canRespondHost}
          canRequestSwap={canRequestHostSwapAction}
          viewerUserId={userId}
          eligibleMembers={group.members}
          attendanceRoster={primaryAttendanceRoster}
          view={hostContext.view}
          viewerHistoryCount={hostContext.history.viewerCount}
        />
      ) : null}

      <EventDietarySection eventStatus={detail.status} rows={sharedDietary} />

      <EventContributionsSection
        eventId={detail.id}
        groupId={detail.groupId}
        eventStatus={detail.status}
        canCoordinate={canCoordinate}
        isProposed={isProposedEvent(detail.status)}
        categories={contributionCategories}
        contributions={eventContributions}
        viewerUserId={userId}
        viewerHistoryCount={contributionHistory.viewerCount}
        sharedDietaryCount={sharedDietary.length}
      />

      <EventDetailManagement
        canEdit={canEdit}
        canCancel={canCancel}
        eventId={detail.id}
        updateAction={updateEventAction}
        defaultTitle={detail.title}
        defaultLocation={detail.location}
        defaultNotes={detail.notes}
        defaultStartsAt={detail.startsAt}
        defaultEndsAt={detail.endsAt}
        status={detail.status}
        timeZone={displayTimeZone}
      />
    </>
  );
}

export function EventDetailHeavyFallback() {
  return (
    <div
      className="mt-6 space-y-4"
      aria-busy="true"
      aria-label="Loading event details"
    >
      <div className="h-10 max-w-md animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900/60" />
      <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900/60" />
    </div>
  );
}
