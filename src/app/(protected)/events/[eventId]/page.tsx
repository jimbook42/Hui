import Link from "next/link";
import { notFound } from "next/navigation";

import { updateEventAction } from "@/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
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
import { getEventDetail } from "@/lib/events/queries";
import { participantRespondPath } from "@/lib/events/paths";
import { getGroupDetail } from "@/lib/groups/queries";
import { getGroupHouseholdMemberView } from "@/lib/households/queries";
import { formatEventTimeRange } from "@/domain/datetime/timezone";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  getCandidateAttendanceRoster,
  getEventConsensusSummary,
  getEventSchedulingContext,
} from "@/lib/scheduling/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

function formatWhen(
  startsAt: string | null,
  endsAt: string | null,
  timeZone: string,
): string {
  if (!startsAt) {
    return "Not set";
  }
  if (endsAt) {
    return formatEventTimeRange(startsAt, endsAt, timeZone);
  }
  return formatEventTimeRange(startsAt, startsAt, timeZone);
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await getEventDetail(supabase, eventId, user!.id);
  if (!detail) {
    notFound();
  }

  const canEdit = canEditEventMetadata(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );
  const canCancel = canCancelEvent(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );

  const group = await getGroupDetail(supabase, detail.groupId, user!.id);
  const [
    scheduling,
    consensus,
    householdView,
    contributionCategories,
    eventContributions,
    contributionHistory,
    sharedDietary,
    hostContext,
  ] = await Promise.all([
    getEventSchedulingContext(supabase, detail.id, detail.groupId, user!.id),
    getEventConsensusSummary(supabase, detail.id),
    group
      ? getGroupHouseholdMemberView(supabase, detail.groupId, group.members)
      : Promise.resolve(null),
    listContributionCategories(supabase, detail.groupId),
    listEventContributions(supabase, detail.id),
    getGroupContributionHistory(supabase, detail.groupId, user!.id),
    listGroupSharedDietary(supabase, detail.groupId),
    group
      ? getEventHostContext(supabase, detail.id, detail.groupId, user!.id)
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
    user!.id,
    detail.createdBy,
    detail.status,
  );
  const canRespond = canRespondToCandidates(detail.status);
  const canFinalise = canFinaliseEvent(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );
  const pendingHostProposal = hostContext
    ? pickPendingHostProposal(hostContext.assignments)
    : null;
  const canAssignHost = canAssignEventHost(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );
  const canRespondHost = canRespondToHostProposal(
    user!.id,
    pendingHostProposal,
    detail.status,
  );
  const canRequestHostSwapAction = hostContext
    ? canRequestHostSwap(user!.id, hostContext.assignments, detail.status)
    : false;
  const showHostSection =
    canViewHostCoordination(detail.status) && Boolean(settings?.hostingEnabled);
  const displayTimeZone =
    detail.timezone ?? settings?.timezone ?? "Pacific/Auckland";
  const attendanceRosters: Record<string, AttendanceRoster> = {};
  if (scheduling.candidates.length > 0) {
    const rosterRows = await Promise.all(
      scheduling.candidates.map(async (candidate) => ({
        id: candidate.id,
        roster: await getCandidateAttendanceRoster(supabase, candidate.id),
      })),
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
    <AppShell title={detail.title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={`/groups/${detail.groupId}`}
          className="underline-offset-4 hover:underline"
        >
          {detail.groupName}
        </Link>
        {" · "}
        <Link
          href={`/groups/${detail.groupId}/events`}
          className="underline-offset-4 hover:underline"
        >
          Events
        </Link>
      </p>

      {detail.status === "confirmed" ? (
        <div
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          <p className="font-medium">Confirmed</p>
          <p className="mt-1">{formatWhen(detail.startsAt, detail.endsAt, displayTimeZone)}</p>
        </div>
      ) : null}
      {detail.status === "cancelled" ? (
        <div
          className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
          role="status"
        >
          This event was cancelled. Scheduling and confirmation are closed.
        </div>
      ) : null}

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
          viewerUserId={user!.id}
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
        viewerUserId={user!.id}
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
    </AppShell>
  );
}
