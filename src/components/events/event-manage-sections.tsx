import type { ReactNode } from "react";

import { updateEventAction } from "@/app/events/actions";
import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { EventDecisionsSection } from "@/components/decisions/event-decisions-section";
import { EventDietarySection } from "@/components/dietary/event-dietary-section";
import { EventDetailManagement } from "@/components/events/event-detail-management";
import { EventParticipantsSummary } from "@/components/events/event-participants-summary";
import { EventScheduling } from "@/components/events/event-scheduling";
import { LiveGatheringVisual } from "@/components/events/attendance-live";
import { EventHostSection } from "@/components/hosts/event-host-section";
import { EventStatusPill } from "@/components/hui/status-pill";
import { HuiSurface } from "@/components/hui/hui-surface";
import { OpenInMapsLink } from "@/components/map/open-in-maps-link";
import { SectionHeader } from "@/components/hui/section-header";
import { isDietaryCoordinationRelevant } from "@/domain/events/food";
import {
  formatClockTime,
  formatLongDay,
  formatShortDay,
  formatTimeSpan,
} from "@/domain/datetime/display";
import { eventKindLabel } from "@/lib/events/labels";
import { loadEventPage } from "@/lib/events/event-page-data";
import type { EventDetail } from "@/lib/events/types";

type SectionProps = { detail: EventDetail; userId: string };

type ManageDomainSectionProps = {
  sectionId: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Major manage domain: one elevated surface; legacy section UIs flatten inside `.hui-embedded`. */
function ManageDomainSection({
  sectionId,
  title,
  description,
  children,
}: ManageDomainSectionProps) {
  return (
    <section aria-labelledby={`${sectionId}-heading`}>
      <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
        <SectionHeader
          title={title}
          description={description}
          id={`${sectionId}-heading`}
        />
        <div className="hui-embedded mt-4">{children}</div>
      </HuiSurface>
    </section>
  );
}

function schedulingSummary(
  detail: EventDetail,
  data: Awaited<ReturnType<typeof loadEventPage>>,
): string {
  const tz = data.displayTimeZone;
  if (detail.status === "confirmed" && detail.startsAt) {
    return `Confirmed · ${formatShortDay(detail.startsAt, tz)} ${formatClockTime(detail.startsAt, tz)}`;
  }
  const n = data.scheduling.candidates.length;
  if (n === 0) {
    return "No times proposed yet";
  }
  const passing = data.consensus.candidates.filter((candidate) => candidate.passes).length;
  const times = `${n} ${n === 1 ? "time" : "times"} on the table`;
  return passing > 0 ? `${times} · ${passing} meet${passing === 1 ? "s" : ""} the rules` : times;
}

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

  const activeCategories = data.contributionCategories.filter((category) => category.archivedAt === null);
  const claimed = data.eventContributions.length;
  const bringSummary =
    activeCategories.length === 0
      ? "No categories yet"
      : data.unclaimedContributionCount > 0
        ? `${claimed} claimed · ${data.unclaimedContributionCount} still needed`
        : "Everything is covered";

  const roster = data.primaryRoster;
  let peopleSummary = "Nobody has answered a time yet";
  if (roster && roster.members.length > 0 && data.counts) {
    const parts = [`${data.counts.yes} coming`];
    if (data.counts.maybe > 0 && data.scheduling.maybeResponsesEnabled) {
      parts.push(`${data.counts.maybe} maybe`);
    }
    if (data.counts.pending > 0) {
      parts.push(`${data.counts.pending} yet to answer`);
    }
    peopleSummary = parts.join(" · ");
  }

  const huiLifecycle =
    data.canEdit || data.canCancel || data.canDelete
      ? "Status, details, and lifecycle"
      : "Status and details";

  return (
    <div className="space-y-6">
      <section aria-labelledby="manage-hui-heading">
        <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
          <SectionHeader title="Hui" description={huiLifecycle} id="manage-hui-heading" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="hui-type-label text-muted-foreground">Status</p>
              <div className="mt-2">
                <EventStatusPill status={detail.status} />
              </div>
            </div>
            {startsAt && !closed ? (
              <div className="min-w-0 text-right">
                <p className="hui-type-label text-muted-foreground">When</p>
                <p className="mt-1 text-sm font-extrabold text-foreground">
                  {formatLongDay(startsAt, tz)}
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  {formatTimeSpan(startsAt, endsAt, tz)}
                </p>
              </div>
            ) : null}
          </div>
          {detail.notes ? (
            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="hui-type-label text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-foreground">
                {detail.notes}
              </p>
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
          {data.canEdit || data.canCancel || data.canDelete ? (
            <div className="hui-embedded mt-6 border-t border-border/60 pt-6">
              <EventDetailManagement
                canEdit={data.canEdit}
                canEditLocation={false}
                canCancel={data.canCancel}
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
              />
            </div>
          ) : null}
        </HuiSurface>
      </section>

      {!closed && roster && roster.members.length > 0 ? (
        <ManageDomainSection
          sectionId="manage-people"
          title="People & attendance"
          description={peopleSummary}
        >
          <LiveGatheringVisual
            roster={roster}
            viewerUserId={userId}
            eventTitle={detail.title}
          />
          {data.householdView && settings ? (
            <div className="mt-6 border-t border-border/60 pt-6">
              <EventParticipantsSummary
                view={data.householdView}
                eligibleMemberCount={data.consensus.eligibleMemberCount}
              />
            </div>
          ) : null}
        </ManageDomainSection>
      ) : null}

      {settings && !closed ? (
        <ManageDomainSection
          sectionId="manage-time"
          title="Time"
          description={schedulingSummary(detail, data)}
        >
          <EventScheduling
            eventId={detail.id}
            groupId={detail.groupId}
            eventStatus={detail.status}
            candidates={data.scheduling.candidates}
            withdrawnCandidates={data.scheduling.withdrawnCandidates}
            maybeResponsesEnabled={data.scheduling.maybeResponsesEnabled}
            minimumAttendees={data.scheduling.minimumAttendees}
            proposalDeadlineHours={settings.proposalDeadlineHours ?? null}
            consensus={data.consensus}
            canAddCandidates={data.canAdd}
            canRemoveCandidates={data.canRemove}
            canRespond={data.canRespond}
            canFinalise={data.canFinalise}
            timeZone={data.displayTimeZone}
            attendanceRosters={data.attendanceRosters}
          />
        </ManageDomainSection>
      ) : null}

      {data.showHostSection && data.hostContext && group && settings && !closed ? (
        <ManageDomainSection sectionId="manage-host" title="Host" description={hostSummary}>
          <EventHostSection
            eventId={detail.id}
            groupId={detail.groupId}
            eventStatus={detail.status}
            hostingEnabled={settings.hostingEnabled}
            canAssign={data.canAssignHost}
            canRespond={data.canAcceptHost}
            canRequestSwap={data.canSwapHost}
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
        </ManageDomainSection>
      ) : null}

      <section aria-labelledby="manage-place-heading">
        <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
          <SectionHeader
            title="Place"
            description={
              detail.location?.trim() ? detail.location : "No place set yet"
            }
            id="manage-place-heading"
          />
          <div className="mt-4 space-y-3">
            <OpenInMapsLink
              location={detail.location}
              coordinates={detail.locationCoordinates}
              className="self-start"
            />
          </div>
          {data.canEdit || (data.canEditLocation && !data.canEdit) ? (
            <div className="hui-embedded mt-6 border-t border-border/60 pt-6">
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
        </HuiSurface>
      </section>

      {!closed ? (
        <ManageDomainSection
          sectionId="manage-decisions"
          title="Decisions"
          description={
            data.decisionPolls.filter((poll) => poll.status === "open").length === 0
              ? data.decisionPolls.length === 0
                ? "No group decisions yet"
                : "No open decisions"
              : `${data.decisionPolls.filter((poll) => poll.status === "open").length} open`
          }
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
            canRespond={data.canRespondToDecisions}
            timeZone={data.displayTimeZone}
            showCreateForm={data.canManageDecisions}
          />
        </ManageDomainSection>
      ) : null}

      {!closed ? (
        <ManageDomainSection
          sectionId="manage-contributions"
          title="Contributions"
          description={bringSummary}
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
        </ManageDomainSection>
      ) : null}

      {detail.status !== "cancelled" && isDietaryCoordinationRelevant(detail.foodInvolvement) ? (
        <ManageDomainSection
          sectionId="manage-dietary"
          title="Dietary"
          description={
            data.sharedDietary.length === 0
              ? "Nothing shared yet"
              : `${data.sharedDietary.length} shared with the group`
          }
        >
          <EventDietarySection eventStatus={detail.status} rows={data.sharedDietary} />
        </ManageDomainSection>
      ) : null}
    </div>
  );
}
