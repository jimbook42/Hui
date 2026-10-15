import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { EventDecisionsSection } from "@/components/decisions/event-decisions-section";
import { HostEventPlaceHeroAction } from "@/components/events/host-event-place-hero-action";
import { EventDietarySection } from "@/components/dietary/event-dietary-section";
import { EventParticipantsSummary } from "@/components/events/event-participants-summary";
import { ConfirmThisTimeButton } from "@/components/events/event-confirm-this-time-button";
import { EventScheduling } from "@/components/events/event-scheduling";
import { LiveGatheringVisual, ViewerResponseCard } from "@/components/events/attendance-live";
import { DisclosureCard } from "@/components/hui/disclosure-card";
import { EventHeroDateBlock } from "@/components/hui/event-hero-date-block";
import { buildEventHeroDateCopy } from "@/domain/datetime/event-hero-dates";
import { HashDisclosureOpener } from "@/components/hui/hash-disclosure-opener";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { OpenInMapsLink } from "@/components/map/open-in-maps-link";
import { formatContributionDisclosureSummary } from "@/domain/contributions/display";
import { isDietaryCoordinationRelevant } from "@/domain/events/food";
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
import { AddToCalendarButton } from "@/components/events/add-to-calendar-button";
import { EventHostGentlePrompt } from "@/components/events/event-host-gentle-prompt";
import { eventConfirmRuleDisplayLine } from "@/domain/events/confirm-rule";
import {
  eventShowsWaitingOnHost,
  organiserPicksHostHasSaidYesOnCandidate,
  WAITING_ON_HOST_STATUS_MESSAGE,
} from "@/domain/scheduling/consensus-display";
import {
  confirmedEventConsensusPassesForDisplay,
  formatConfirmedHeroStatusLine,
} from "@/domain/scheduling/confirmed-because";
import { formatEventTimeDisclosureSummary } from "@/domain/scheduling/event-time-disclosure-summary";
import {
  multiTimeAnswerDetailRows,
  multiTimeViewerVisualState,
} from "@/domain/events/participant-flow";
import { whoIsComingPresentation } from "@/domain/events/who-is-coming";
import { EventHostSection } from "@/components/hosts/event-host-section";
import { canDownloadEventIcs } from "@/lib/calendar/event-ics-export";
import { buildEventTimeLabelMap } from "@/domain/datetime/candidate-time-labels";
import { eventHeroTimeFallbackCopy } from "@/domain/events/event-hero-time-fallback";
import { shouldShowEventHeroTime } from "@/domain/events/event-hero-visibility";
import { buildProposedHuiGuidance } from "@/domain/events/proposed-guidance";
import { replyByLabelForEvent } from "@/domain/scheduling/response-deadline";
import { eventKindLabel } from "@/lib/events/labels";
import { GroupInviteShareBlock } from "@/components/groups/group-invite-share-block";
import { loadEventPage } from "@/lib/events/event-page-data";
import { eventManagePath } from "@/lib/events/paths";
import type { EventDetail } from "@/lib/events/types";

type SectionProps = { detail: EventDetail; userId: string };

/* ------------------------------------------------------------------ hero facts */

type EventHeroMetaProps = SectionProps & {
  pageData?: Awaited<ReturnType<typeof loadEventPage>>;
  appOrigin?: string;
  inviteToken?: string | null;
};

export function EventHeroMeta({
  detail,
  userId,
  pageData,
  appOrigin,
  inviteToken = null,
}: EventHeroMetaProps & {
  pageData: Awaited<ReturnType<typeof loadEventPage>>;
  appOrigin: string;
}) {
  const data = pageData;
  const tz = data.displayTimeZone;
  const startsAt = detail.startsAt ?? data.focusCandidate?.startsAt ?? null;
  const endsAt = detail.startsAt ? detail.endsAt : (data.focusCandidate?.endsAt ?? null);
  const confirmed = detail.status === "confirmed";
  const completed = detail.status === "completed";
  const closed = detail.status === "cancelled" || completed;
  const acceptedHost = data.hostContext?.view.acceptedHost ?? null;
  const isAcceptedHost = acceptedHost?.userId === userId;
  const hasPlace = Boolean(detail.location?.trim());
  const showHostPlaceAction = isAcceptedHost && data.canEditLocation && !closed;
  const heroDateCopy = shouldShowEventHeroTime(detail.status, startsAt)
    ? buildEventHeroDateCopy({
        startsAt: startsAt!,
        endsAt,
        timeZone: tz,
        showRelativeWhen: !completed && !confirmed,
      })
    : null;

  const respondable = data.canRespond && data.primaryCandidate !== null;
  const replyByLabel = replyByLabelForEvent(
    detail.status,
    detail.responseDeadlineAt,
    tz,
  );
  // Contributions that would be released if the viewer declined (host-following categories stay).
  const followsHostCategoryIds = new Set(
    data.contributionCategories.filter((category) => category.followsHost).map((category) => category.id),
  );
  const timeFallback = eventHeroTimeFallbackCopy(detail.status);
  const confirmedStatusLine =
    confirmed && data.settings
      ? formatConfirmedHeroStatusLine({
          consensusRule: data.settings.consensusRule,
          counts: data.counts,
          maybeResponsesEnabled: data.scheduling.maybeResponsesEnabled,
          confirmationMethod: detail.confirmationMethod,
          confirmRule: detail.confirmRule,
          consensusCurrentlyPasses: confirmedEventConsensusPassesForDisplay(
            data.anyCandidatePasses,
            detail.confirmationMethod,
          ),
        })
      : null;
  const confirmRuleLine =
    detail.status === "proposing" ? eventConfirmRuleDisplayLine(detail.confirmRule) : null;
  const waitingOnHost =
    detail.status === "proposing" &&
    eventShowsWaitingOnHost(data.consensus.candidates);

  const viewerReleasableContributions = data.eventContributions.filter(
    (row) =>
      row.userId === userId &&
      row.status === "accepted" &&
      !(row.categoryId && followsHostCategoryIds.has(row.categoryId)),
  ).length;

  return (
    <div className="mt-5 space-y-5">
      {data.organiserPicksConfirm ? (
        <HuiSurface tone="sage" shape="soft" padding="md" className="hui-rise-2" role="status">
          <p className="text-lg font-extrabold text-foreground">Ready to confirm a time?</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {organiserPicksHostHasSaidYesOnCandidate(
              data.organiserPicksConfirm.candidateId,
              data.acceptedHostUserId,
              data.attendanceRosters,
            )
              ? "The host has said Yes. Pick the time you want to lock in for the group."
              : "Pick the time you want to lock in for the group."}
          </p>
          <div className="mt-4">
            <ConfirmThisTimeButton
              eventId={detail.id}
              candidateId={data.organiserPicksConfirm.candidateId}
            />
          </div>
        </HuiSurface>
      ) : null}
      {inviteToken ? (
        <GroupInviteShareBlock
          groupName={detail.groupName}
          inviteToken={inviteToken}
          appOrigin={appOrigin}
          focusEventId={detail.id}
          focusHuiTitle={detail.title}
          variant="page"
        />
      ) : null}
      {heroDateCopy ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            {detail.status === "cancelled" ? (
              <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground" role="status">
                Cancelled
              </p>
            ) : null}
            <EventHeroDateBlock
              copy={heroDateCopy}
              badgeTone={
                detail.status === "cancelled" ? "secondary" : confirmed || completed ? "sage" : "primary"
              }
              showProposedHint={!confirmed && !completed && !closed}
            />
            {confirmedStatusLine ? (
              <p className="mt-3 text-sm font-semibold text-muted-foreground" role="status">
                {confirmedStatusLine}
              </p>
            ) : null}
            {confirmRuleLine ? (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{confirmRuleLine}</p>
            ) : null}
            {waitingOnHost ? (
              <p className="mt-2 text-sm font-extrabold text-foreground" role="status">
                {WAITING_ON_HOST_STATUS_MESSAGE}
              </p>
            ) : null}
          </div>
          {canDownloadEventIcs(detail.status, startsAt) ? (
            <AddToCalendarButton eventId={detail.id} variant="page" className="shrink-0" />
          ) : null}
        </div>
      ) : timeFallback ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold leading-tight text-foreground">{timeFallback.title}</p>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{timeFallback.subtitle}</p>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2 text-base font-bold text-foreground">
        <li className="flex items-start gap-3">
          <PinIcon size={20} className="mt-0.5 shrink-0 text-accent" />
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="block break-words">
              {detail.location?.trim() ? detail.location : (
                <span className="text-muted-foreground">Place still being worked out</span>
              )}
            </span>
            <OpenInMapsLink
              location={detail.location}
              coordinates={detail.locationCoordinates}
              className="mt-0 self-start"
            />
            {showHostPlaceAction ? (
              <HostEventPlaceHeroAction
                eventId={detail.id}
                defaultTitle={detail.title}
                defaultNotes={detail.notes}
                defaultLocation={detail.location}
                defaultCoordinates={detail.locationCoordinates}
                viewerHomeLocation={data.viewerHomeLocation}
                hasPlace={hasPlace}
              />
            ) : null}
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
        {replyByLabel ? (
          <li className="flex items-start gap-3 font-semibold text-muted-foreground">
            <ClockIcon size={20} className="mt-0.5 shrink-0" />
            <span className="min-w-0">{replyByLabel}</span>
          </li>
        ) : null}
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
          serverResponse={
            data.multiTimeAnswerPresentation?.statusChoice ?? data.viewerResponse
          }
          answerSummaryLabel={data.multiTimeAnswerPresentation?.summaryLabel ?? null}
          answerDetailRows={
            data.multiTimeAnswerPresentation
              ? multiTimeAnswerDetailRows(
                  data.scheduling.candidates,
                  buildEventTimeLabelMap(data.scheduling.candidates, tz),
                )
              : null
          }
          answerIconState={
            data.multiTimeAnswerPresentation
              ? multiTimeViewerVisualState(data.multiTimeAnswerPresentation)
              : null
          }
          showPlaceFollowUp={data.multiTimeAnswerPresentation?.showPlaceFollowUp ?? true}
          serverPrivateNote={data.viewerPrivateNote}
          maybeResponsesEnabled={data.scheduling.maybeResponsesEnabled}
          confirmed={confirmed}
          hasContribution={viewerReleasableContributions > 0}
          isAcceptedHost={acceptedHost?.userId === userId}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------ host swap confirmation */

export function HostSwappedConfirmationCard() {
  return (
    <HuiSurface tone="sage" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-lg font-extrabold text-foreground">Swap request sent</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Hui will suggest another host when someone is available. You can still help with planning from
        this page.
      </p>
    </HuiSurface>
  );
}

/* ------------------------------------------------ proposed guidance */

export async function EventProposedGuidanceCard({
  detail,
  userId,
  justProposed,
}: SectionProps & { justProposed: boolean }) {
  const data = await loadEventPage(detail, userId);
  const anyCandidatePasses = data.consensus.candidates.some((candidate) => candidate.passes);
  const guidance = buildProposedHuiGuidance(
    {
      status: detail.status,
      isProposer: detail.createdBy === userId,
      canRespond: data.canRespond,
      viewerResponse: data.viewerResponse,
      hasCandidate: data.primaryCandidate !== null,
      canFinalise: data.canFinalise,
      anyCandidatePassesConsensus: anyCandidatePasses,
    },
    { justProposed },
  );

  if (!guidance.show) {
    return null;
  }

  return (
    <HuiSurface tone="sage" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-lg font-extrabold text-foreground">{guidance.headline}</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{guidance.summary}</p>
      <div className="mt-4">
        <p className="text-sm font-extrabold text-foreground">What happens next</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm font-semibold text-muted-foreground">
          {guidance.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {guidance.nextStepTitle && guidance.nextStepDetail ? (
        <div className="mt-4 rounded-hui-md bg-background/60 px-4 py-3">
          <p className="text-sm font-extrabold text-foreground">{guidance.nextStepTitle}</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
            {guidance.nextStepDetail}
          </p>
        </div>
      ) : null}
    </HuiSurface>
  );
}

/* ------------------------------------------------------------- people + attention */

export async function EventPeopleCard({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const closed = detail.status === "cancelled";

  if (closed) {
    return null;
  }

  const presentation = whoIsComingPresentation({
    eventStatus: detail.status,
    candidates: data.scheduling.candidates,
    attendanceRosters: data.attendanceRosters,
    maybeResponsesEnabled: data.scheduling.maybeResponsesEnabled,
    focusCandidateId: data.focusCandidate?.id ?? null,
  });
  const timeLabels =
    presentation.mode === "per-candidate"
      ? buildEventTimeLabelMap(
          data.scheduling.candidates.filter((c) => c.status === "proposed"),
          data.displayTimeZone,
          "compact",
        )
      : {};

  return (
    <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
      <SectionHeader
        title="Who is coming"
        description={
          presentation.mode === "single" && presentation.summary
            ? presentation.summary
            : undefined
        }
      />
      {presentation.mode === "per-candidate" ? (
        <ul className="mt-4 space-y-6">
          {presentation.rows.map((row) => (
            <li key={row.candidateId}>
              <p className="text-sm font-extrabold text-foreground">
                {timeLabels[row.candidateId] ?? "Proposed time"}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{row.summary}</p>
              <LiveGatheringVisual
                roster={row.roster}
                viewerUserId={userId}
                eventTitle={detail.title}
                className="mt-3"
              />
            </li>
          ))}
          <p className="hui-type-supporting text-center">
            Icons around the table show how people answered (full = yes, dashed = maybe). Private
            notes are never shown.
          </p>
        </ul>
      ) : presentation.mode === "single" && presentation.roster && presentation.roster.members.length > 0 ? (
        <>
          <LiveGatheringVisual
            roster={presentation.roster}
            viewerUserId={userId}
            eventTitle={detail.title}
            className="mt-4"
          />
          <p className="hui-type-supporting mt-4 text-center">
            Icons around the table show how people answered (full = yes, dashed = maybe). Private
            notes are never shown.
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
  decision: { href: "#decisions", label: "Answer" },
} as const;

export async function EventManageEntryCard({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  if (!data.canAccessManage) {
    return null;
  }

  return (
    <section aria-labelledby="event-manage-entry" className="hui-rise-2">
      <HuiSurface tone="subtle" shape="soft" padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 id="event-manage-entry" className="font-extrabold text-foreground">
            Manage this hui
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
            Update planning, people, hosting, place, and what to bring.
          </p>
        </div>
        <HuiLinkButton
          href={eventManagePath(detail.id)}
          variant="primary"
          size="default"
          className="w-full shrink-0 sm:w-auto"
        >
          Open manage hui
        </HuiLinkButton>
      </HuiSurface>
    </section>
  );
}

export async function EventOpenDecisionsCard({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const closed = detail.status === "cancelled" || detail.status === "completed";
  if (closed || !data.canCreateDecisions) {
    return null;
  }

  const openPolls = data.decisionPolls.filter((poll) => poll.status === "open");
  const showEmpty = openPolls.length === 0 && data.decisionPolls.length === 0;
  const showOpen = openPolls.length > 0;

  if (!showEmpty && !showOpen) {
    return null;
  }

  const summary = showEmpty
    ? "Ask a simple question and let everyone choose"
    : openPolls.length === 1
      ? openPolls[0].question
      : `${openPolls.length} decisions open`;

  return (
    <HuiSurface padding="lg" shape="organic" elevated className="hui-rise-2">
      <SectionHeader title="Group decisions" description={summary} />
      <div className="mt-4">
        <EventDecisionsSection
          eventId={detail.id}
          bundles={
            showOpen
              ? data.decisionBundles.filter((bundle) => bundle.decision.status === "open")
              : []
          }
          members={data.groupMembers.map((member) => ({
            userId: member.userId,
            displayName: member.displayName,
          }))}
          viewerUserId={userId}
          canManage={data.canManageDecisions}
          canCreate={data.canCreateDecisions}
          canRespond={data.canRespondToDecisions}
          timeZone={data.displayTimeZone}
          compactOpenOnly
          showSectionHeader={showEmpty}
        />
      </div>
    </HuiSurface>
  );
}

export async function EventHostGentlePromptSection({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const suggestedName = data.hostContext?.view.pendingProposal?.displayName ?? null;
  if (!data.canAcceptHost && !data.canSwapHost) {
    return null;
  }

  return (
    <EventHostGentlePrompt
      eventId={detail.id}
      canAcceptHost={data.canAcceptHost}
      canRequestSwap={data.canSwapHost}
      hostSwapHasReplacement={data.hostSwapReplacementAvailable}
      suggestedHostName={suggestedName}
      hostingEnabled={Boolean(data.settings?.hostingEnabled)}
      hostPlaceRequired={detail.hostPlaceRequired}
      eventLocation={detail.location}
      eventCoordinates={detail.locationCoordinates}
      viewerHomeLocation={data.viewerHomeLocation}
    />
  );
}

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

  const bringSummary = formatContributionDisclosureSummary(
    data.requestedContributionSlotCount,
    data.unclaimedContributionCount,
    data.claimedContributionCount,
  );
  const showContributionCoordination =
    isDietaryCoordinationRelevant(detail.foodInvolvement) &&
    data.requestedContributionSlotCount > 0;

  const openDecisionCount = data.decisionPolls.filter((poll) => poll.status === "open").length;
  const decisionsSummary =
    openDecisionCount === 0
      ? data.decisionPolls.length === 0
        ? "No decisions yet"
        : "Past decisions in history"
      : openDecisionCount === 1
        ? "1 open decision"
        : `${openDecisionCount} open decisions`;

  const hasAbout = Boolean(detail.notes || detail.recurrenceSeries || detail.kind);

  const candidateTimeLabels = buildEventTimeLabelMap(
    [...data.scheduling.candidates, ...data.scheduling.withdrawnCandidates],
    data.displayTimeZone,
  );
  const replyByLabel = replyByLabelForEvent(
    detail.status,
    detail.responseDeadlineAt,
    data.displayTimeZone,
  );
  const timeDisclosureSummary = formatEventTimeDisclosureSummary({
    status: detail.status,
    startsAt: detail.startsAt,
    timeZone: data.displayTimeZone,
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

  return (
    <section aria-labelledby="event-details" className="hui-rise-3 space-y-3">
      <HashDisclosureOpener />
      <SectionHeader
        as="h2"
        id="event-details"
        title="Details"
        description="Open anything you need. Nothing here is required."
      />

      {settings ? (
        <DisclosureCard
          id="scheduling"
          title="Times and agreement"
          summary={timeDisclosureSummary}
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

      {detail.status !== "cancelled" && detail.status !== "completed" ? (
        <DisclosureCard
          id="decisions"
          title="Polls"
          summary={decisionsSummary}
          icon={<HelpIcon size={20} />}
          attention={attentionKinds.has("decision")}
          defaultOpen={attentionKinds.has("decision")}
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
          />
        </DisclosureCard>
      ) : null}

      {showContributionCoordination ? (
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

      {detail.status !== "cancelled" && isDietaryCoordinationRelevant(detail.foodInvolvement) ? (
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
