import { updateEventAction } from "@/app/events/actions";
import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { EventDietarySection } from "@/components/dietary/event-dietary-section";
import { EventDetailManagement } from "@/components/events/event-detail-management";
import { EventParticipantsSummary } from "@/components/events/event-participants-summary";
import { EventScheduling } from "@/components/events/event-scheduling";
import { LiveGatheringVisual, ViewerResponseCard } from "@/components/events/attendance-live";
import { DisclosureCard } from "@/components/hui/disclosure-card";
import { EventDateBadge } from "@/components/hui/event-date-badge";
import { HashDisclosureOpener } from "@/components/hui/hash-disclosure-opener";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import {
  BowlIcon,
  ClockIcon,
  HelpIcon,
  LeafIcon,
  PeopleIcon,
  PinIcon,
  SparkIcon,
  UserIcon,
} from "@/components/hui/icons";
import { SectionHeader } from "@/components/hui/section-header";
import { EventHostSection } from "@/components/hosts/event-host-section";
import {
  formatClockTime,
  formatLongDay,
  formatShortDay,
  formatTimeSpan,
  relativeDayLabel,
} from "@/domain/datetime/display";
import { eventKindLabel } from "@/lib/events/labels";
import { loadEventPage } from "@/lib/events/event-page-data";
import type { EventDetail } from "@/lib/events/types";

type SectionProps = { detail: EventDetail; userId: string };

/* ------------------------------------------------------------------ hero facts */

export async function EventHeroMeta({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const tz = data.displayTimeZone;
  const startsAt = detail.startsAt ?? data.focusCandidate?.startsAt ?? null;
  const endsAt = detail.startsAt ? detail.endsAt : (data.focusCandidate?.endsAt ?? null);
  const confirmed = detail.status === "confirmed";
  const closed = detail.status === "cancelled" || detail.status === "completed";
  const acceptedHost = data.hostContext?.view.acceptedHost ?? null;
  const when = startsAt && !closed ? relativeDayLabel(startsAt, tz) : null;

  const respondable = data.canRespond && data.primaryCandidate !== null;
  // Contributions that would be released if the viewer declined (host-following categories stay).
  const followsHostCategoryIds = new Set(
    data.contributionCategories.filter((category) => category.followsHost).map((category) => category.id),
  );
  const viewerReleasableContributions = data.eventContributions.filter(
    (row) =>
      row.userId === userId &&
      row.status === "accepted" &&
      !(row.categoryId && followsHostCategoryIds.has(row.categoryId)),
  ).length;

  return (
    <div className="mt-5 space-y-5">
      <div className="flex items-center gap-4">
        <EventDateBadge
          startsAt={startsAt}
          timeZone={tz}
          size="lg"
          tone={confirmed ? "sage" : "primary"}
          fallbackLabel="TBC"
        />
        <div className="min-w-0 flex-1">
          {startsAt ? (
            <>
              <p className="text-xl font-extrabold leading-tight text-foreground">
                {formatLongDay(startsAt, tz)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-muted-foreground">
                <ClockIcon size={17} className="shrink-0" />
                <span>{formatTimeSpan(startsAt, endsAt, tz)}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                {when ? (
                  <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-extrabold text-foreground">
                    {when}
                  </span>
                ) : null}
                {!confirmed && !closed ? (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Proposed time — not confirmed yet
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-extrabold leading-tight text-foreground">Time still to be agreed</p>
              <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
                Nobody has put a time on the table yet.
              </p>
            </>
          )}
        </div>
      </div>

      <ul className="space-y-2 text-base font-bold text-foreground">
        <li className="flex items-start gap-3">
          <PinIcon size={20} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0">
            {detail.location?.trim() ? detail.location : (
              <span className="text-muted-foreground">Place still being worked out</span>
            )}
          </span>
        </li>
        {acceptedHost ? (
          <li className="flex items-start gap-3">
            <SparkIcon size={20} className="mt-0.5 shrink-0 text-accent" />
            <span className="min-w-0">Hosted by {acceptedHost.displayName}</span>
          </li>
        ) : null}
        <li className="flex items-start gap-3 font-semibold text-muted-foreground">
          <UserIcon size={20} className="mt-0.5 shrink-0" />
          <span className="min-w-0">Proposed by {detail.creatorDisplayName}</span>
        </li>
      </ul>

      {detail.status === "cancelled" ? (
        <HuiSurface tone="subtle" shape="soft" padding="md" role="status">
          <p className="font-bold text-foreground">This hui was cancelled.</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
            Scheduling and confirmation are closed.
          </p>
        </HuiSurface>
      ) : detail.status === "completed" ? (
        <HuiSurface tone="subtle" shape="soft" padding="md" role="status">
          <p className="font-bold text-foreground">This hui has happened.</p>
        </HuiSurface>
      ) : respondable && data.primaryCandidate ? (
        <ViewerResponseCard
          eventId={detail.id}
          candidateId={data.primaryCandidate.id}
          serverResponse={data.viewerResponse}
          maybeResponsesEnabled={data.scheduling.maybeResponsesEnabled}
          confirmed={confirmed}
          hasContribution={viewerReleasableContributions > 0}
          isAcceptedHost={acceptedHost?.userId === userId}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- people + attention */

export async function EventPeopleCard({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const roster = data.primaryRoster;
  const counts = data.counts;
  const closed = detail.status === "cancelled";

  if (closed) {
    return null;
  }

  let summary = "";
  if (counts) {
    const parts = [`${counts.yes} coming`];
    if (counts.maybe > 0 && data.scheduling.maybeResponsesEnabled) {
      parts.push(`${counts.maybe} maybe`);
    }
    if (counts.pending > 0) {
      parts.push(`${counts.pending} yet to answer`);
    }
    summary = parts.join(" · ");
  }

  return (
    <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
      <SectionHeader
        title="Who is coming"
        description={roster && roster.members.length > 0 ? summary : undefined}
      />
      {roster && roster.members.length > 0 ? (
        <>
          <LiveGatheringVisual
            roster={roster}
            viewerUserId={userId}
            eventTitle={detail.title}
            className="mt-4"
          />
          <p className="hui-type-supporting mt-4 text-center">
            Shapes show how people answered. Private notes are never shown.
          </p>
        </>
      ) : (
        <p className="hui-type-supporting mt-3">
          Nobody has been asked about a time yet, so there is no one to show.
        </p>
      )}
    </HuiSurface>
  );
}

const ATTENTION_TARGET = {
  host: { href: "#host", label: "Open hosting" },
  confirm: { href: "#scheduling", label: "Review times" },
  contribute: { href: "#contributions", label: "Pick something" },
} as const;

export async function EventAttentionCard({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  // "respond" is handled by the answer strip in the hero.
  const items = data.attention.filter((item) => item.kind !== "respond");
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="event-attention" className="hui-rise-2 space-y-3">
      <SectionHeader as="h2" id="event-attention" title="Needs your attention" />
      <ul className="space-y-3">
        {items.map((item) => {
          if (item.kind === "respond") {
            return null;
          }
          const target = ATTENTION_TARGET[item.kind];
          return (
            <li key={item.kind}>
              <HuiSurface tone="clay" shape="soft" padding="md" className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold leading-tight text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{item.detail}</p>
                </div>
                <HuiLinkButton href={target.href} size="sm" shape="melt" variant="primary" className="shrink-0">
                  {target.label}
                </HuiLinkButton>
              </HuiSurface>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- details list */

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

export async function EventDetailsList({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const { settings, group } = data;
  const attentionKinds = new Set(data.attention.map((item) => item.kind));

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

  const hasAbout = Boolean(detail.notes || detail.recurrenceSeries || detail.kind);

  return (
    <section aria-labelledby="event-details" className="hui-rise-3 space-y-3">
      <HashDisclosureOpener />
      <SectionHeader as="h2" id="event-details" title="Details" description="Open anything you need. Nothing here is required." />

      {settings ? (
        <DisclosureCard
          id="scheduling"
          title="Times and agreement"
          summary={schedulingSummary(detail, data)}
          icon={<ClockIcon size={20} />}
          attention={attentionKinds.has("confirm")}
          defaultOpen={attentionKinds.has("confirm")}
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
        </DisclosureCard>
      ) : null}

      {data.showHostSection && data.hostContext && group && settings ? (
        <DisclosureCard
          title="Hosting"
          summary={hostSummary}
          icon={<UserIcon size={20} />}
          attention={attentionKinds.has("host")}
          defaultOpen={attentionKinds.has("host")}
        >
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
          />
        </DisclosureCard>
      ) : null}

      <DisclosureCard
        title="What to bring"
        summary={bringSummary}
        icon={<BowlIcon size={20} />}
        attention={attentionKinds.has("contribute")}
        defaultOpen={attentionKinds.has("contribute")}
      >
        <EventContributionsSection
          eventId={detail.id}
          groupId={detail.groupId}
          eventStatus={detail.status}
          canCoordinate={data.coordinateContributions}
          isProposed={data.isProposed}
          categories={data.contributionCategories}
          contributions={data.eventContributions}
          viewerUserId={userId}
          viewerHistoryCount={data.contributionHistory.viewerCount}
          sharedDietaryCount={data.sharedDietary.length}
        />
      </DisclosureCard>

      {detail.status !== "cancelled" ? (
        <DisclosureCard
          title="Dietary needs"
          summary={
            data.sharedDietary.length === 0
              ? "Nothing shared yet"
              : `${data.sharedDietary.length} shared with the group`
          }
          icon={<LeafIcon size={20} />}
        >
          <EventDietarySection eventStatus={detail.status} rows={data.sharedDietary} />
        </DisclosureCard>
      ) : null}

      {data.householdView && settings ? (
        <DisclosureCard
          title="Group members"
          summary={`${data.consensus.eligibleMemberCount} ${
            data.consensus.eligibleMemberCount === 1 ? "member" : "members"
          }`}
          icon={<PeopleIcon size={20} />}
        >
          <EventParticipantsSummary
            view={data.householdView}
            eligibleMemberCount={data.consensus.eligibleMemberCount}
          />
        </DisclosureCard>
      ) : null}

      {hasAbout ? (
        <DisclosureCard
          title="About this hui"
          summary={eventKindLabel(detail.kind)}
          icon={<HelpIcon size={20} />}
        >
          <dl className="space-y-4 text-sm text-foreground">
            <div>
              <dt className="hui-type-label text-muted-foreground">Type</dt>
              <dd className="mt-1 font-semibold">{eventKindLabel(detail.kind)}</dd>
            </div>
            {detail.notes ? (
              <div>
                <dt className="hui-type-label text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap font-semibold">{detail.notes}</dd>
              </div>
            ) : null}
            {detail.recurrenceSeries ? (
              <div>
                <dt className="hui-type-label text-muted-foreground">Recurrence series</dt>
                <dd className="mt-1 font-semibold">
                  {detail.recurrenceSeries.title} — every {detail.recurrenceSeries.intervalCount}{" "}
                  {detail.recurrenceSeries.intervalUnit}(s) from {detail.recurrenceSeries.startsOn}
                  {detail.recurrenceSeries.archivedAt ? " (inactive)" : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </DisclosureCard>
      ) : null}

      {data.canEdit || data.canCancel ? (
        <DisclosureCard
          title="Manage this hui"
          summary={
            data.canEdit && data.canCancel
              ? "Edit details or cancel"
              : data.canEdit
                ? "Edit details"
                : "Cancel"
          }
          icon={<SparkIcon size={20} />}
        >
          <EventDetailManagement
            canEdit={data.canEdit}
            canCancel={data.canCancel}
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
          />
        </DisclosureCard>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------- skeletons */

export function EventBodySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading event">
      <div className="hui-skeleton h-72 !rounded-hui-xl" />
      <div className="hui-skeleton h-16 !rounded-hui-xl" />
      <div className="hui-skeleton h-16 !rounded-hui-xl" />
      <div className="hui-skeleton h-16 !rounded-hui-xl" />
    </div>
  );
}
