import Link from "next/link";
import { notFound } from "next/navigation";

import { updateEventAction } from "@/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { EditEventForm } from "@/components/events/event-form";
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
import { getGroupDetail } from "@/lib/groups/queries";
import { getGroupHouseholdMemberView } from "@/lib/households/queries";
import { formatEventTimeRange } from "@/domain/datetime/timezone";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  getCandidateAttendanceRoster,
  getEventConsensusSummary,
  getEventSchedulingContext,
} from "@/lib/scheduling/queries";
import { eventKindLabel, eventStatusLabel } from "@/lib/events/labels";
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

      <dl className="mt-8 grid gap-3 text-sm text-zinc-800 dark:text-zinc-200">
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd>{eventStatusLabel(detail.status)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Type</dt>
          <dd>{eventKindLabel(detail.kind)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Proposed by</dt>
          <dd>{detail.creatorDisplayName}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">When</dt>
          <dd>
            {formatWhen(detail.startsAt, detail.endsAt, displayTimeZone)}
          </dd>
        </div>
        {detail.location ? (
          <div>
            <dt className="text-zinc-500">Location</dt>
            <dd>{detail.location}</dd>
          </div>
        ) : null}
        {detail.notes ? (
          <div>
            <dt className="text-zinc-500">Notes</dt>
            <dd className="whitespace-pre-wrap">{detail.notes}</dd>
          </div>
        ) : null}
        {detail.recurrenceSeries ? (
          <div>
            <dt className="text-zinc-500">Recurrence series</dt>
            <dd>
              {detail.recurrenceSeries.title} — every {detail.recurrenceSeries.intervalCount}{" "}
              {detail.recurrenceSeries.intervalUnit}(s) from {detail.recurrenceSeries.startsOn}
              {detail.recurrenceSeries.archivedAt ? " (inactive)" : ""}
            </dd>
          </div>
        ) : null}
      </dl>

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

      {canEdit ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit</h2>
          <div className="mt-4 max-w-lg">
            <EditEventForm
              action={updateEventAction}
              eventId={detail.id}
              defaultTitle={detail.title}
              defaultLocation={detail.location}
              defaultNotes={detail.notes}
              defaultStartsAt={detail.startsAt}
              defaultEndsAt={detail.endsAt}
              scheduleLocked={detail.status === "confirmed"}
              timeZone={displayTimeZone}
            />
          </div>
        </section>
      ) : null}

      {canCancel ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Cancel</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Cancelling keeps the event record but marks it as cancelled.
          </p>
          <CancelEventButton eventId={detail.id} />
        </section>
      ) : null}
    </AppShell>
  );
}
