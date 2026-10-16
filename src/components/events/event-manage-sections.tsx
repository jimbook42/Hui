import { updateEventAction } from "@/app/events/actions";
import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { EventDecisionsSection } from "@/components/decisions/event-decisions-section";
import { EventDietarySection } from "@/components/dietary/event-dietary-section";
import { EventDetailManagement } from "@/components/events/event-detail-management";
import { EventManageTopActionBar } from "@/components/events/event-manage-top-action-bar";
import { EventParticipantsSummary } from "@/components/events/event-participants-summary";
import { EventScheduling } from "@/components/events/event-scheduling";
import { LiveGatheringVisual } from "@/components/events/attendance-live";
import { OrganiserAttendanceRosterList } from "@/components/events/organiser-attendance-roster-list";
import { formatWhoIsComingSummary } from "@/domain/events/who-is-coming";
import { EventHostSection } from "@/components/hosts/event-host-section";
import { DisclosureCard } from "@/components/hui/disclosure-card";
import { HashDisclosureOpener } from "@/components/hui/hash-disclosure-opener";
import { EventStatusPill } from "@/components/hui/status-pill";
import { HuiSurface } from "@/components/hui/hui-surface";
import { OpenInMapsLink } from "@/components/map/open-in-maps-link";
import { formatContributionDisclosureSummary } from "@/domain/contributions/display";
import { contributionsDisclosureDefaultOpen } from "@/domain/contributions/event-bring-disclosure";
import { isDietaryCoordinationRelevant } from "@/domain/events/food";
import {
  defaultOpenManageSection,
  type ManageSectionId,
} from "@/domain/events/manage-navigation";
import { buildEventTimeLabelMap } from "@/domain/datetime/candidate-time-labels";
import { formatLongDay, formatShortDay, formatTimeSpan } from "@/domain/datetime/display";
import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import { confirmedEventConsensusPassesForDisplay } from "@/domain/scheduling/confirmed-because";
import { formatEventTimeDisclosureSummary } from "@/domain/scheduling/event-time-disclosure-summary";
import { replyByLabelForEvent } from "@/domain/scheduling/response-deadline";
import { formatDateTimeLocalInTimeZone } from "@/domain/datetime/timezone";
import { EventConfirmRuleManageForm } from "@/components/events/event-confirm-rule-manage-form";
import { ResponseDeadlineManageForm } from "@/components/events/response-deadline-manage-form";
import {
  eventShowsWaitingOnHost,
  WAITING_ON_HOST_STATUS_MESSAGE,
} from "@/domain/scheduling/consensus-display";
import { eventKindLabel } from "@/lib/events/labels";
import { loadEventPage } from "@/lib/events/event-page-data";
import type { EventDetail } from "@/lib/events/types";

type SectionProps = { detail: EventDetail; userId: string };

export async function EventManageSections({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const { settings, group } = data;
  const tz = data.displayTimeZone;
  const startsAt = detail.startsAt ?? data.focusCandidate?.startsAt ?? null;
  const endsAt = detail.startsAt ? detail.endsAt : (data.focusCandidate?.endsAt ?? null);
  const closed = detail.status === "cancelled" || detail.status === "completed";

  const hostName = data.hostContext?.view.acceptedHost?.displayName ?? null;
  const suggestedName = data.hostContext?.view.pendingProposal?.displayName ?? null;
  const hostSummary = hostName
    ? `${hostName} is hosting`
    : suggestedName
      ? `${suggestedName} suggested`
      : "No host yet";

  const hasActiveBringCategories = data.contributionCategories.some(
    (category) => category.archivedAt === null,
  );
  const bringSummary = hasActiveBringCategories
    ? formatContributionDisclosureSummary(
        data.requestedContributionSlotCount,
        data.unclaimedContributionCount,
        data.claimedContributionCount,
      )
    : "Nothing to bring yet";
  const showContributionCoordination = isDietaryCoordinationRelevant(detail.foodInvolvement);

  const roster = data.primaryRoster;
  let peopleSummary = "Nobody has answered a time yet";
  if (roster && roster.members.length > 0 && data.counts) {
    peopleSummary = formatWhoIsComingSummary(
      data.counts,
      data.scheduling.maybeResponsesEnabled,
      { eventStatus: detail.status },
    );
  }

  const huiLifecycle =
    data.canEdit || data.canCancel || data.canComplete || data.canDelete
      ? "Status and details"
      : "Status and details";

  const openDecisionCount = data.decisionPolls.filter((poll) => poll.status === "open").length;
  const decisionsSummary =
    openDecisionCount === 0
      ? data.decisionPolls.length === 0
        ? "No group decisions yet"
        : "No open decisions"
      : `${openDecisionCount} open`;

  const defaultSection = defaultOpenManageSection({
    canFinalise: data.canFinalise,
    anyCandidatePasses: data.anyCandidatePasses,
    coordinateContributions: data.coordinateContributions,
    unclaimedContributionCount: data.unclaimedContributionCount,
    canAssignHost: data.canAssignHost,
    hasAcceptedHost: Boolean(hostName),
  });

  const sectionOpen = (id: ManageSectionId) => defaultSection === id;

  const candidateTimeLabels = buildEventTimeLabelMap(
    [...data.scheduling.candidates, ...data.scheduling.withdrawnCandidates],
    tz,
  );
  const timeDisclosureSummary = formatEventTimeDisclosureSummary({
    status: detail.status,
    startsAt: detail.startsAt,
    timeZone: tz,
    consensusCurrentlyPasses:
      detail.status === "confirmed"
        ? confirmedEventConsensusPassesForDisplay(
            data.anyCandidatePasses,
            detail.confirmationMethod,
          )
        : undefined,
    candidateCount: data.scheduling.candidates.length,
    passingCandidateCount: data.consensus.candidates.filter((candidate) => candidate.passes).length,
  });
  const replyByLabel = replyByLabelForEvent(
    detail.status,
    detail.responseDeadlineAt,
    tz,
  );
  const canEditResponseDeadline =
    data.canEdit && eventAcceptsResponseDeadline(detail.status) && detail.responseDeadlineAt;
  const defaultDeadlineLocal =
    detail.responseDeadlineAt
      ? formatDateTimeLocalInTimeZone(detail.responseDeadlineAt, tz)
      : "";

  const overviewWhen =
    startsAt && !closed
      ? `${formatShortDay(startsAt, tz)} · ${formatTimeSpan(startsAt, endsAt, tz)}`
      : null;
  const waitingOnHost =
    detail.status === "proposing" && eventShowsWaitingOnHost(data.consensus.candidates);

  return (
    <div className="space-y-3">
      <HashDisclosureOpener />

      <HuiSurface padding="md" shape="soft" className="hui-rise-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EventStatusPill
            status={detail.status}
            consensusCurrentlyPasses={
              detail.status === "confirmed"
                ? confirmedEventConsensusPassesForDisplay(
                    data.anyCandidatePasses,
                    detail.confirmationMethod,
                  )
                : undefined
            }
          />
          {overviewWhen ? (
            <p className="text-sm font-bold text-muted-foreground">{overviewWhen}</p>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          Open a section below to update planning, hosting, or place.
        </p>
        {waitingOnHost ? (
          <p className="mt-3 text-sm font-extrabold text-foreground" role="status">
            {WAITING_ON_HOST_STATUS_MESSAGE}
          </p>
        ) : null}
      </HuiSurface>

      <EventManageTopActionBar
        eventId={detail.id}
        timeZone={tz}
        defaultStartsAt={detail.startsAt}
        defaultEndsAt={detail.endsAt}
        canReschedule={data.canReschedule}
        canCancel={data.canCancel}
        canDelete={data.canDelete}
      />

      <DisclosureCard id="hui" title="Hui" summary={huiLifecycle} defaultOpen={sectionOpen("hui")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="hui-type-label text-muted-foreground">Status</p>
            <div className="mt-2">
              <EventStatusPill
                status={detail.status}
                consensusCurrentlyPasses={
                  detail.status === "confirmed"
                    ? confirmedEventConsensusPassesForDisplay(
                        data.anyCandidatePasses,
                        detail.confirmationMethod,
                      )
                    : undefined
                }
              />
            </div>
          </div>
          {startsAt && !closed ? (
            <div className="min-w-0 text-right">
              <p className="hui-type-label text-muted-foreground">When</p>
              <p className="mt-1 text-sm font-extrabold text-foreground">{formatLongDay(startsAt, tz)}</p>
              <p className="text-sm font-semibold text-muted-foreground">
                {formatTimeSpan(startsAt, endsAt, tz)}
              </p>
            </div>
          ) : null}
        </div>
        {detail.notes ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="hui-type-label text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-foreground">{detail.notes}</p>
          </div>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="hui-type-label text-muted-foreground">Type</dt>
            <dd className="mt-1 font-semibold text-foreground">{eventKindLabel(detail.kind)}</dd>
          </div>
          <div>
            <dt className="hui-type-label text-muted-foreground">Proposed by</dt>
            <dd className="mt-1 font-semibold text-foreground">{detail.creatorDisplayName}</dd>
          </div>
        </dl>
        {canEditResponseDeadline ? (
          <div className="mt-6 border-t border-border/60 pt-6">
            <h3 className="hui-type-section text-foreground">Reply deadline</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {replyByLabel ?? "Set when members should reply by."}
            </p>
            <div className="mt-4 max-w-lg">
              <ResponseDeadlineManageForm
                eventId={detail.id}
                defaultDeadlineLocal={defaultDeadlineLocal}
              />
            </div>
          </div>
        ) : null}
        {data.canEdit || data.canCancel || data.canComplete || data.canReschedule || data.canDelete ? (
          <div className="mt-6 border-t border-border/60 pt-6">
            <EventDetailManagement
              canEdit={data.canEdit}
              canEditLocation={false}
              canCancel={data.canCancel}
              canComplete={data.canComplete}
              canReschedule={data.canReschedule}
              canDelete={data.canDelete}
              eventId={detail.id}
              updateAction={updateEventAction}
              defaultTitle={detail.title}
              defaultLocation={detail.location}
              defaultNotes={detail.notes}
              defaultStartsAt={detail.startsAt}
              defaultEndsAt={detail.endsAt}
              defaultCoordinates={detail.locationCoordinates}
              status={detail.status}
              timeZone={data.displayTimeZone}
              viewerHomeLocation={data.viewerHomeLocation}
              hideLifecycleActions
            />
          </div>
        ) : null}
      </DisclosureCard>

      {!closed && roster && roster.members.length > 0 ? (
        <DisclosureCard
          id="people"
          title="People & attendance"
          summary={peopleSummary}
          defaultOpen={sectionOpen("people")}
        >
          <LiveGatheringVisual roster={roster} viewerUserId={userId} eventTitle={detail.title} />
          <OrganiserAttendanceRosterList roster={roster} />
          {data.householdView && settings ? (
            <div className="mt-6 border-t border-border/60 pt-6">
              <EventParticipantsSummary
                view={data.householdView}
                eligibleMemberCount={data.consensus.eligibleMemberCount}
              />
            </div>
          ) : null}
        </DisclosureCard>
      ) : null}

      {settings && !closed ? (
        <DisclosureCard
          id="time"
          title="Time"
          summary={timeDisclosureSummary}
          defaultOpen={sectionOpen("time")}
        >
          <EventConfirmRuleManageForm
            eventId={detail.id}
            confirmRule={detail.confirmRule}
            canEdit={data.canFinalise}
          />
          <EventScheduling
            eventId={detail.id}
            groupId={detail.groupId}
            eventStatus={detail.status}
            candidates={data.scheduling.candidates}
            withdrawnCandidates={data.scheduling.withdrawnCandidates}
            maybeResponsesEnabled={data.scheduling.maybeResponsesEnabled}
            minimumAttendees={data.scheduling.minimumAttendees}
            proposalDeadlineHours={settings.proposalDeadlineHours ?? null}
            replyByLabel={replyByLabel}
            consensus={data.consensus}
            canAddCandidates={data.canAdd}
            canRemoveCandidates={data.canRemove}
            canRespond={data.canRespond}
            canFinalise={data.canFinalise}
            timeZone={data.displayTimeZone}
            candidateTimeLabels={candidateTimeLabels}
            attendanceRosters={data.attendanceRosters}
          />
        </DisclosureCard>
      ) : null}

      {data.showHostSection && data.hostContext && group && settings && !closed ? (
        <DisclosureCard
          id="host"
          title="Host"
          summary={hostSummary}
          defaultOpen={sectionOpen("host")}
        >
          <EventHostSection
            eventId={detail.id}
            groupId={detail.groupId}
            eventStatus={detail.status}
            eventStartsAt={detail.startsAt}
            hostingEnabled={settings.hostingEnabled}
            canAssign={data.canAssignHost}
            canRespond={data.canAcceptHost}
            canRequestSwap={data.canSwapHost}
            hostSwapHasReplacement={data.hostSwapReplacementAvailable}
            viewerUserId={userId}
            eligibleMembers={group.members}
            attendanceRoster={data.primaryRoster}
            view={data.hostContext.view}
            viewerHistoryCount={data.hostContext.history.viewerCount}
            eventLocation={detail.location}
            eventCoordinates={detail.locationCoordinates}
            hostPlaceRequired={detail.hostPlaceRequired}
            viewerHomeLocation={data.viewerHomeLocation}
          />
        </DisclosureCard>
      ) : null}

      <DisclosureCard
        id="place"
        title="Place"
        summary={detail.location?.trim() ? detail.location : "No place set yet"}
        defaultOpen={sectionOpen("place")}
      >
        <OpenInMapsLink
          location={detail.location}
          coordinates={detail.locationCoordinates}
          className="self-start"
        />
        {data.canEdit || (data.canEditLocation && !data.canEdit) ? (
          <div className="mt-6 border-t border-border/60 pt-6">
            <EventDetailManagement
              canEdit={data.canEdit}
              canEditLocation={data.canEditLocation && !data.canEdit}
              canCancel={false}
              canDelete={false}
              eventId={detail.id}
              updateAction={updateEventAction}
              defaultTitle={detail.title}
              defaultLocation={detail.location}
              defaultNotes={detail.notes}
              defaultStartsAt={detail.startsAt}
              defaultEndsAt={detail.endsAt}
              defaultCoordinates={detail.locationCoordinates}
              status={detail.status}
              timeZone={data.displayTimeZone}
              viewerHomeLocation={data.viewerHomeLocation}
            />
          </div>
        ) : null}
      </DisclosureCard>

      {!closed && showContributionCoordination ? (
        <DisclosureCard
          id="contributions"
          title="Who's bringing what"
          summary={bringSummary}
          defaultOpen={
            sectionOpen("contributions") ||
            contributionsDisclosureDefaultOpen(
              false,
              hasActiveBringCategories,
              data.canAssignContributions,
            )
          }
        >
          <EventContributionsSection
            eventId={detail.id}
            groupId={detail.groupId}
            eventStatus={detail.status}
            canCoordinate={data.coordinateContributions}
            canAssign={data.canAssignContributions}
            isProposed={data.isProposed}
            categories={data.contributionCategories}
            contributions={data.eventContributions}
            viewerUserId={userId}
            acceptedHostUserId={data.acceptedHostUserId}
            members={data.groupMembers.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
            }))}
            viewerHistoryCount={data.contributionHistory.viewerCount}
            sharedDietaryCount={data.sharedDietary.length}
          />
        </DisclosureCard>
      ) : null}

      {!closed ? (
        <DisclosureCard
          id="decisions"
          title="Polls"
          summary={decisionsSummary}
          defaultOpen={sectionOpen("decisions")}
        >
          <EventDecisionsSection
            eventId={detail.id}
            bundles={data.decisionBundles}
            members={data.groupMembers.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
            }))}
            viewerUserId={userId}
            canManage={data.canManageDecisions}
            canCreate={data.canCreateDecisions}
            canRespond={data.canRespondToDecisions}
            timeZone={data.displayTimeZone}
            showCreateForm={data.canCreateDecisions}
          />
        </DisclosureCard>
      ) : null}

      {detail.status !== "cancelled" && isDietaryCoordinationRelevant(detail.foodInvolvement) ? (
        <DisclosureCard
          id="dietary"
          title="Dietary"
          summary={
            data.sharedDietary.length === 0
              ? "Nothing shared yet"
              : `${data.sharedDietary.length} shared with the group`
          }
          defaultOpen={sectionOpen("dietary")}
        >
          <EventDietarySection eventStatus={detail.status} rows={data.sharedDietary} />
        </DisclosureCard>
      ) : null}
    </div>
  );
}
