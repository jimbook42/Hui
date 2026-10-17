import { EventDecisionsSection } from "@/components/decisions/event-decisions-section";
import { EventManageTopActionBar } from "@/components/events/event-manage-top-action-bar";
import { EventProposeInviteSection } from "@/components/events/event-propose-invite-section";
import { EventScheduling } from "@/components/events/event-scheduling";
import { ConfirmThisTimeButton } from "@/components/events/event-confirm-this-time-button";
import { DisclosureCard } from "@/components/hui/disclosure-card";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { EventStatusPill } from "@/components/hui/status-pill";
import { PeopleIcon, SparkIcon } from "@/components/hui/icons";
import { buildEventTimeLabelMap } from "@/domain/datetime/candidate-time-labels";
import { buildHuiPageNextAction } from "@/domain/events/hui-page-next-action";
import { buildProposedHuiGuidance } from "@/domain/events/proposed-guidance";
import {
  organiserPicksHostHasSaidYesOnCandidate,
} from "@/domain/scheduling/consensus-display";
import { confirmedEventConsensusPassesForDisplay } from "@/domain/scheduling/confirmed-because";
import { formatDateTimeLocalInTimeZone } from "@/domain/datetime/timezone";
import { replyByLabelForEvent } from "@/domain/scheduling/response-deadline";
import { loadEventPage } from "@/lib/events/event-page-data";
import { eventManagePath } from "@/lib/events/paths";
import type { EventDetail } from "@/lib/events/types";

type SectionProps = { detail: EventDetail; userId: string };

export async function EventSummaryHeader({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const startsAt = detail.startsAt ?? data.focusCandidate?.startsAt ?? null;
  const { statusLine, nextAction } = buildHuiPageNextAction({
    status: detail.status,
    startsAt,
    endsAt: detail.endsAt,
    timeZone: data.displayTimeZone,
    attention: data.attention,
    canRespond: data.canRespond,
    hasCandidate: data.primaryCandidate !== null,
    viewerResponse: data.viewerResponse,
    organiserPicksConfirm: data.organiserPicksConfirm,
  });

  const consensusPasses =
    detail.status === "confirmed"
      ? confirmedEventConsensusPassesForDisplay(
          data.anyCandidatePasses,
          detail.confirmationMethod,
        )
      : undefined;

  return (
    <HuiSurface padding="md" shape="soft" className="hui-rise-2" role="status">
      <div className="flex flex-wrap items-center gap-3">
        <EventStatusPill status={detail.status} consensusCurrentlyPasses={consensusPasses} />
        <p className="min-w-0 flex-1 text-sm font-extrabold text-foreground">{statusLine}</p>
      </div>
      {nextAction ? (
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          Next: <span className="text-foreground">{nextAction}</span>
        </p>
      ) : null}
      {data.organiserPicksConfirm ? (
        <div className="mt-4 border-t border-border/50 pt-4">
          <p className="text-sm font-semibold text-muted-foreground">
            {organiserPicksHostHasSaidYesOnCandidate(
              data.organiserPicksConfirm.candidateId,
              data.acceptedHostUserId,
              data.attendanceRosters,
            )
              ? "The host has said Yes. Pick the time to lock in."
              : "Pick the time to lock in for the group."}
          </p>
          <div className="mt-3">
            <ConfirmThisTimeButton
              eventId={detail.id}
              candidateId={data.organiserPicksConfirm.candidateId}
            />
          </div>
        </div>
      ) : null}
    </HuiSurface>
  );
}

export async function EventMainTimesSection({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const closed = detail.status === "cancelled" || detail.status === "completed";
  if (closed || !data.settings) {
    return null;
  }

  const acceptedHost = data.hostContext?.view.acceptedHost ?? null;
  const candidateTimeLabels = buildEventTimeLabelMap(
    [...data.scheduling.candidates, ...data.scheduling.withdrawnCandidates],
    data.displayTimeZone,
    "compact",
  );
  const replyByLabel = replyByLabelForEvent(
    detail.status,
    detail.responseDeadlineAt,
    data.displayTimeZone,
  );

  if (data.scheduling.candidates.length === 0 && data.scheduling.withdrawnCandidates.length === 0) {
    return null;
  }

  const timeSummary =
    detail.status === "confirmed" && detail.startsAt
      ? candidateTimeLabels[data.scheduling.candidates.find((c) => c.status === "selected")?.id ?? ""] ??
        "Confirmed time"
      : `${data.scheduling.candidates.length} proposed ${
          data.scheduling.candidates.length === 1 ? "time" : "times"
        }`;

  return (
    <DisclosureCard
      id="scheduling"
      title="Times"
      summary={timeSummary}
      icon={<SparkIcon size={20} />}
      defaultOpen={true}
      attention={data.attention.some((item) => item.kind === "confirm" || item.kind === "respond")}
    >
      <EventScheduling
        eventId={detail.id}
        groupId={detail.groupId}
        eventStatus={detail.status}
        candidates={data.scheduling.candidates}
        withdrawnCandidates={data.scheduling.withdrawnCandidates}
        maybeResponsesEnabled={data.scheduling.maybeResponsesEnabled}
        minimumAttendees={data.scheduling.minimumAttendees}
        proposalDeadlineHours={data.settings.proposalDeadlineHours ?? null}
        replyByLabel={replyByLabel}
        consensus={data.consensus}
        canAddCandidates={false}
        canRemoveCandidates={data.canRemove}
        canRespond={data.canRespond}
        canFinalise={data.canFinalise}
        timeZone={data.displayTimeZone}
        candidateTimeLabels={candidateTimeLabels}
        attendanceRosters={data.attendanceRosters}
        forceCompactTimeList={true}
        timesOnlySurface={true}
        perTimeHosting={
          data.showHostSection && data.settings.hostingEnabled
            ? {
                canAcceptHost: data.canAcceptHost,
                canRequestSwap: data.canSwapHost,
                hostSwapHasReplacement: data.hostSwapReplacementAvailable,
                suggestedHostName: data.hostContext?.view.pendingProposal?.displayName ?? null,
                hostingEnabled: data.settings.hostingEnabled,
                hostPlaceRequired: detail.hostPlaceRequired,
                defaultLocation: detail.location,
                defaultCoordinates: detail.locationCoordinates,
                viewerHomeLocation: data.viewerHomeLocation,
                acceptedHostDisplayName: acceptedHost?.displayName ?? null,
              }
            : null
        }
      />
    </DisclosureCard>
  );
}

export async function EventCollapsedInviteSection({
  detail,
  userId,
  justProposed,
}: SectionProps & { justProposed?: boolean }) {
  const showForOrganiser =
    detail.status === "proposing" &&
    (detail.createdBy === userId || detail.viewerRole === "owner" || detail.viewerRole === "admin");

  if (!showForOrganiser) {
    return null;
  }

  return (
    <DisclosureCard
      title="Invite people"
      summary="Share or copy the invite link"
      icon={<PeopleIcon size={20} />}
      defaultOpen={justProposed === true}
    >
      <EventProposeInviteSection
        detail={detail}
        inviterDisplayName={detail.creatorDisplayName}
        gatheringType={detail.gatheringType}
        gatheringTypeCustom={detail.gatheringTypeCustom}
        planningTargetDate={detail.planningTargetDate}
        timeZone={detail.timezone ?? "Pacific/Auckland"}
        compactLayout
      />
    </DisclosureCard>
  );
}

export async function EventPlanningHelpSection({
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
    <DisclosureCard
      title="How planning works"
      summary={guidance.headline}
      defaultOpen={false}
    >
      <div className="space-y-3 text-sm font-semibold text-muted-foreground">
        <p>{guidance.summary}</p>
        <div>
          <p className="font-extrabold text-foreground">What happens next</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            {guidance.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        {guidance.nextStepTitle && guidance.nextStepDetail ? (
          <div className="rounded-hui-md bg-muted px-4 py-3">
            <p className="font-extrabold text-foreground">{guidance.nextStepTitle}</p>
            <p className="mt-0.5">{guidance.nextStepDetail}</p>
          </div>
        ) : null}
      </div>
    </DisclosureCard>
  );
}

export async function EventOrganiserToolsSection({ detail, userId }: SectionProps) {
  const data = await loadEventPage(detail, userId);
  const closed = detail.status === "cancelled" || detail.status === "completed";

  const showDecisions = !closed && data.canCreateDecisions;
  const showManage = data.canAccessManage;

  if (!showDecisions && !showManage) {
    return null;
  }

  const openPolls = data.decisionPolls.filter((poll) => poll.status === "open");
  const decisionsSummary = showDecisions
    ? openPolls.length === 0 && data.decisionPolls.length === 0
      ? "Ask the group a question"
      : openPolls.length === 1
        ? openPolls[0].question
        : `${openPolls.length} decisions open`
    : null;

  const tz = data.displayTimeZone;
  const defaultDeadlineLocal = detail.responseDeadlineAt
    ? formatDateTimeLocalInTimeZone(detail.responseDeadlineAt, tz)
    : "";
  const candidateTimeLabels = buildEventTimeLabelMap(
    data.scheduling.candidates.filter((c) => c.status === "proposed"),
    tz,
    "compact",
  );
  const adminPickCandidates = data.scheduling.candidates
    .filter((candidate) => candidate.status === "proposed")
    .map((candidate) => ({
      id: candidate.id,
      label: candidateTimeLabels[candidate.id] ?? "Proposed time",
    }));

  const summaryParts = [
    showManage ? "Manage planning" : null,
    decisionsSummary,
  ].filter(Boolean);

  return (
    <DisclosureCard
      title="Organiser tools"
      summary={summaryParts.join(" · ") || "Planning controls"}
      defaultOpen={false}
    >
      <div className="space-y-5">
        {showManage ? (
          <>
            <EventManageTopActionBar
              eventId={detail.id}
              timeZone={tz}
              defaultStartsAt={detail.startsAt}
              defaultEndsAt={detail.endsAt}
              defaultDeadlineLocal={defaultDeadlineLocal}
              lastAvailabilityNudgeAt={detail.lastAvailabilityNudgeAt}
              canReschedule={data.canReschedule}
              canAdminPickTime={data.canAdminPickTime && adminPickCandidates.length > 0}
              adminPickCandidates={adminPickCandidates}
              canEditResponseDeadline={data.canEditResponseDeadline}
              canNudgeAvailability={data.canNudgeAvailability}
              canCancel={data.canCancel}
              canDelete={data.canDelete}
            />
            <HuiLinkButton
              href={eventManagePath(detail.id)}
              variant="secondary"
              size="default"
              className="w-full sm:w-auto"
            >
              Open full manage hui
            </HuiLinkButton>
          </>
        ) : null}
        {showDecisions ? (
          <EventDecisionsSection
            eventId={detail.id}
            bundles={
              openPolls.length > 0
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
            timeZone={tz}
            compactOpenOnly
            showSectionHeader={openPolls.length === 0 && data.decisionPolls.length === 0}
          />
        ) : null}
      </div>
    </DisclosureCard>
  );
}
