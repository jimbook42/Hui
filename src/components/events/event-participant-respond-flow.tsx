"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { EventActionState } from "@/app/events/actions";
import { addCandidateAction, setAvailabilityResponseAction } from "@/app/events/scheduling-actions";
import { claimContributionAction } from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import {
  WallClockDateField,
  WallClockTimeField,
} from "@/components/events/wall-clock-picker-field";
import { AttendanceChoice } from "@/components/hui/attendance-choice";
import { EventPlaceMap } from "@/components/hui/event-location-panel";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { ArrowLeftIcon, BowlIcon, ClockIcon, PinIcon } from "@/components/hui/icons";
import { PendingButton } from "@/components/ui/pending-button";
import { attendanceStateFromChoice } from "@/domain/events/home";
import { buildContributionBoard } from "@/domain/contributions/display";
import {
  buildContributionSlots,
  contributionCategoryHeadline,
  isContributionSlotFilled,
  sortContributionSlotsForDisplay,
} from "@/domain/contributions/slots";
import { formatCompactEventTimeRange, formatEventTimeRange } from "@/domain/datetime/timezone";
import {
  nextStepAfterAttendanceSave,
  participantFlowStepsForBack,
  type ParticipantFlowStep,
} from "@/domain/events/participant-flow";
import { participantPlaceView } from "@/domain/events/participant-place";
import type { EventCoordinates } from "@/domain/events/location";
import { parseWallClockCandidate } from "@/domain/events/proposal";
import { availabilityResponseOptions } from "@/domain/scheduling/consensus-display";
import {
  participantAttendanceChoiceLabel,
  participantAttendanceSummaryLabel,
} from "@/domain/scheduling/participant-labels";
import type { StandingAvailabilityHint } from "@/domain/scheduling/standing-availability";
import type { AvailabilityChoice } from "@/domain/scheduling/types";
import { eventDetailPath } from "@/lib/events/paths";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";
import type { RespondSecondaryData } from "@/lib/events/respond-page-data";
import type { EventCandidateRow } from "@/lib/scheduling/types";

type EventParticipantRespondFlowProps = {
  eventId: string;
  groupId: string;
  eventTitle: string;
  groupName: string;
  timeZone: string;
  maybeResponsesEnabled: boolean;
  canRespond: boolean;
  canCoordinateContributions: boolean;
  canSuggestTime: boolean;
  candidate: EventCandidateRow;
  placeView: ReturnType<typeof participantPlaceView>;
  /** Hui's stored pin for the place, when the organiser set one. */
  coordinates: EventCoordinates | null;
  hostingEnabled: boolean;
  viewerUserId: string;
  initialViewerResponse: AvailabilityChoice | null;
  standingAvailabilityHint: StandingAvailabilityHint | null;
  secondaryDataPromise?: Promise<RespondSecondaryData>;
};

const FLOW_PROGRESS: ParticipantFlowStep[] = ["time", "place", "bring", "done"];

function readStepFromHash(): ParticipantFlowStep {
  if (typeof window === "undefined") {
    return "time";
  }
  const hash = window.location.hash.replace(/^#/, "");
  const valid: ParticipantFlowStep[] = [
    "time",
    "declined",
    "suggest-time",
    "suggest-done",
    "place",
    "bring",
    "done",
  ];
  return valid.includes(hash as ParticipantFlowStep) ? (hash as ParticipantFlowStep) : "time";
}

export function EventParticipantRespondFlow({
  eventId,
  groupId,
  eventTitle,
  groupName,
  timeZone,
  maybeResponsesEnabled,
  canRespond,
  canCoordinateContributions,
  canSuggestTime,
  candidate,
  placeView,
  coordinates,
  viewerUserId,
  initialViewerResponse,
  standingAvailabilityHint,
  secondaryDataPromise,
}: EventParticipantRespondFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<ParticipantFlowStep>(() => readStepFromHash());
  const [responseOverride, setResponseOverride] = useState<AvailabilityChoice | null>(null);
  const viewerResponse = responseOverride ?? initialViewerResponse;
  const [pendingChoice, setPendingChoice] = useState<AvailabilityChoice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestSubmittedRange, setSuggestSubmittedRange] = useState<string | null>(null);
  const [timeDate, setTimeDate] = useState("");
  const [timeStart, setTimeStart] = useState("12:00");
  // The end time is optional: an empty value means "start only".
  const [timeEnd, setTimeEnd] = useState("");
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSavingAttendance, startSaveAttendance] = useTransition();
  const [isSubmittingSuggest, startSubmitSuggest] = useTransition();
  const [secondary, setSecondary] = useState<RespondSecondaryData | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!secondaryDataPromise) {
      return;
    }
    let cancelled = false;
    // Two-argument then: promises streamed from the server are thenables whose `.then` does not return a promise.
    secondaryDataPromise.then(
      (data) => {
        if (!cancelled) {
          setSecondary(data);
        }
      },
      () => {
        if (!cancelled) {
          setSecondaryError("Contribution details could not be loaded. Try again in a moment.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [secondaryDataPromise]);

  const acceptedHostUserId = secondary?.acceptedHostUserId ?? null;

  const board = useMemo(() => {
    const categories = secondary?.categories ?? [];
    const contributions = secondary?.contributions ?? [];
    return buildContributionBoard(
      categories,
      contributions,
      viewerUserId,
      acceptedHostUserId,
    );
  }, [secondary, viewerUserId, acceptedHostUserId]);

  const contributionSlots = useMemo(() => {
    const categories = secondary?.categories ?? [];
    const contributions = secondary?.contributions ?? [];
    return sortContributionSlotsForDisplay(
      buildContributionSlots(categories, contributions, viewerUserId, acceptedHostUserId),
    );
  }, [secondary, viewerUserId, acceptedHostUserId]);

  const categories = secondary?.categories ?? [];

  const timeLabel = formatEventTimeRange(candidate.startsAt, candidate.endsAt, timeZone);

  const suggestPreview = useMemo(() => {
    const parsed = parseWallClockCandidate(timeDate, timeStart, timeEnd, timeZone);
    if (!parsed) {
      return null;
    }
    return formatCompactEventTimeRange(parsed.startsAt, parsed.endsAt, timeZone);
  }, [timeDate, timeStart, timeEnd, timeZone]);
  const attendanceOptions = availabilityResponseOptions(maybeResponsesEnabled);

  const pushStep = useCallback((next: ParticipantFlowStep) => {
    setStep(next);
    window.history.pushState({ participantStep: next }, "", `#${next}`);
  }, []);

  const goBack = useCallback(() => {
    const previous = participantFlowStepsForBack(step);
    if (!previous) {
      return;
    }
    setStep(previous);
    window.history.pushState({ participantStep: previous }, "", `#${previous}`);
  }, [step]);

  useEffect(() => {
    if (step === "time") {
      markInteraction("respond_route", "first-useful-ui");
      markInteraction("respond_route", "fully-settled");
    }
  }, [step]);

  useEffect(() => {
    if (secondary) {
      markInteraction("respond_route", "secondary-content-visible");
    }
  }, [secondary]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const fromState = (event.state as { participantStep?: ParticipantFlowStep } | null)
        ?.participantStep;
      if (fromState) {
        setStep(fromState);
        return;
      }
      const previous = participantFlowStepsForBack(step);
      if (previous) {
        setStep(previous);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step]);

  function saveAttendance(choice: AvailabilityChoice) {
    if (!canRespond || isSavingAttendance) {
      return;
    }
    if (choice === viewerResponse) {
      // Already saved: just move on without another round trip.
      pushStep(nextStepAfterAttendanceSave(choice));
      return;
    }
    const interaction = `attendance_${choice}`;
    beginInteraction(interaction);
    markInteraction(interaction, "handler-start");
    setActionError(null);
    const priorOverride = responseOverride;
    const nextStep = nextStepAfterAttendanceSave(choice);
    setPendingChoice(choice);
    setResponseOverride(choice);
    pushStep(nextStep);
    markInteraction(interaction, "optimistic-ui-visible");
    markInteraction(interaction, "usable-ui");

    startSaveAttendance(async () => {
      markInteraction(interaction, "request-start");
      const formData = new FormData();
      formData.set("event_id", eventId);
      formData.set("candidate_id", candidate.id);
      formData.set("response", choice);
      const result: EventActionState = await setAvailabilityResponseAction({}, formData);
      markInteraction(interaction, "request-end");
      if (result.error) {
        setActionError(result.error);
        setPendingChoice(null);
        setResponseOverride(priorOverride);
        pushStep("time");
        endInteraction(interaction);
        return;
      }
      setPendingChoice(null);
      window.setTimeout(() => {
        markInteraction(interaction, "navigation-start");
        router.refresh();
        markInteraction(interaction, "navigation-end");
        endInteraction(interaction);
      }, 0);
    });
  }

  function openSuggestTime(returnStep: ParticipantFlowStep = "time") {
    setSuggestError(null);
    if (returnStep === "time") {
      pushStep("suggest-time");
    } else {
      pushStep("suggest-time");
    }
  }

  function submitSuggestedTime() {
    setSuggestError(null);
    const parsed = parseWallClockCandidate(timeDate, timeStart, timeEnd, timeZone);
    if (!parsed) {
      setSuggestError("Choose a valid date and time range.");
      return;
    }
    startSubmitSuggest(async () => {
      const formData = new FormData();
      formData.set("event_id", eventId);
      formData.set("group_id", groupId);
      formData.set("starts_at", parsed.startsAt);
      if (parsed.endsAt) {
        formData.set("ends_at", parsed.endsAt);
      }
      const result = await addCandidateAction({}, formData);
      if (result.error) {
        setSuggestError(result.error);
        return;
      }
      setSuggestSubmittedRange(
        formatCompactEventTimeRange(parsed.startsAt, parsed.endsAt, timeZone),
      );
      pushStep("suggest-done");
      router.refresh();
    });
  }

  const showBack = participantFlowStepsForBack(step) !== null;
  const stepIndex = FLOW_PROGRESS.indexOf(step);
  const chosenState = attendanceStateFromChoice(viewerResponse, maybeResponsesEnabled);

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <header className="hui-rise flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="hui-type-label text-accent">{groupName}</p>
          <p className="mt-0.5 truncate text-lg font-extrabold leading-tight text-foreground">{eventTitle}</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{timeLabel}</p>
        </div>
        <Link
          href={eventDetailPath(eventId)}
          className="hui-focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface px-4 text-sm font-extrabold text-foreground hui-shadow-sm"
        >
          Event
        </Link>
      </header>

      {stepIndex >= 0 ? (
        <ol className="mt-5 flex gap-1.5" aria-label="Progress">
          {FLOW_PROGRESS.map((name, index) => (
            <li
              key={name}
              aria-current={index === stepIndex ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                index <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </ol>
      ) : null}

      {showBack ? (
        <button
          type="button"
          onClick={goBack}
          className="hui-focus-ring -ml-2 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={18} />
          Back
        </button>
      ) : null}

      {viewerResponse && (step === "declined" || step === "place" || step === "bring" || step === "done") ? (
        <div className="mt-4 flex items-center gap-3 rounded-hui-xl bg-surface px-4 py-2 hui-shadow-sm">
          <AttendanceDot
            state={chosenState}
            label={participantAttendanceSummaryLabel(viewerResponse)}
            size="sm"
          />
          <p className="min-w-0 flex-1 text-sm font-extrabold text-foreground">
            Your answer: {participantAttendanceSummaryLabel(viewerResponse)}
          </p>
          <button
            type="button"
            onClick={() => pushStep("time")}
            disabled={!canRespond}
            className="hui-focus-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm font-extrabold text-accent underline underline-offset-4 disabled:opacity-50"
          >
            Change response
          </button>
        </div>
      ) : null}

      {step === "time" ? (
        <section className="hui-rise mt-6 space-y-5">
          {candidate.status === "proposed" ? (
            <>
              <h1 className="hui-type-page-title text-foreground">When could you make it?</h1>
              <p className="hui-type-supporting">
                Tell the group when you&apos;re available so everyone can work out a time that
                suits.
              </p>
            </>
          ) : (
            <h1 className="hui-type-page-title text-foreground">Can you make this?</h1>
          )}
          {standingAvailabilityHint && viewerResponse === null ? (
            <HuiSurface padding="sm" className="border border-accent/20 bg-accent/5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Your usual availability
              </p>
              <p className="mt-1 text-sm font-extrabold text-foreground">
                {standingAvailabilityHint.summary}
              </p>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                For this hui, choose what works — your answer below is what counts.
              </p>
            </HuiSurface>
          ) : null}
          <div className="space-y-3">
            {attendanceOptions.map((option) => {
              const isSelected = viewerResponse === option;
              const isPending = pendingChoice === option && isSavingAttendance;
              return (
                <AttendanceChoice
                  key={option}
                  state={attendanceStateFromChoice(option, true)}
                  label={participantAttendanceChoiceLabel(option)}
                  selected={isSelected}
                  pending={isPending}
                  disabled={!canRespond || (isSavingAttendance && pendingChoice !== option)}
                  onClick={() => saveAttendance(option)}
                />
              );
            })}
            {canSuggestTime ? (
              <AttendanceChoice
                state="action"
                icon={<ClockIcon size={20} />}
                label="Suggest another time"
                onClick={() => openSuggestTime()}
              />
            ) : null}
          </div>
          {actionError ? (
            <p className="hui-message-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {viewerResponse && !pendingChoice ? (
            <p className="hui-message-success" role="status">
              Saved: {participantAttendanceSummaryLabel(viewerResponse)}
            </p>
          ) : null}
          {viewerResponse === "available" || viewerResponse === "maybe" ? (
            <PendingButton type="button" size="touch" onClick={() => pushStep("place")}>
              Continue
            </PendingButton>
          ) : null}
        </section>
      ) : null}

      {step === "declined" ? (
        <section className="hui-rise mt-6 space-y-5">
          <h1 className="hui-type-page-title text-foreground">You can&apos;t make it.</h1>
          <p className="hui-type-supporting">
            Thanks for letting the group know
            {viewerResponse ? ` — ${participantAttendanceSummaryLabel(viewerResponse)}.` : "."}
          </p>
          <div className="space-y-3">
            {canSuggestTime ? (
              <PendingButton type="button" size="touch" onClick={() => openSuggestTime()}>
                Suggest another time
              </PendingButton>
            ) : null}
            <PendingButton
              type="button"
              variant={canSuggestTime ? "soft" : "primary"}
              size="touch"
              onClick={() => pushStep("done")}
            >
              Done
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "suggest-time" ? (
        <section className="hui-rise mt-6 space-y-5">
          <div>
            <h1 className="hui-type-page-title text-foreground">Suggest another time</h1>
            <p className="hui-type-supporting mt-2">
              This adds a new time for the group to consider. It does not change your answer.
            </p>
          </div>
          <HuiSurface padding="md" shape="soft" className="space-y-4">
            <WallClockDateField label="Date" value={timeDate} onChange={setTimeDate} />
            <div className="grid grid-cols-2 gap-3">
              <WallClockTimeField label="Starts" value={timeStart} onChange={setTimeStart} />
              <WallClockTimeField
                label="Ends (optional)"
                value={timeEnd}
                onChange={setTimeEnd}
                clearable
              />
            </div>
            {suggestPreview ? (
              <p className="rounded-hui-md bg-sage-soft px-4 py-3 text-sm font-bold text-foreground">
                {suggestPreview}
              </p>
            ) : null}
          </HuiSurface>
          {suggestError ? (
            <p className="hui-message-error" role="alert">
              {suggestError}
            </p>
          ) : null}
          <PendingButton
            type="button"
            size="touch"
            pendingLabel="Submitting…"
            disabled={isSubmittingSuggest}
            onClick={submitSuggestedTime}
          >
            Submit suggestion
          </PendingButton>
        </section>
      ) : null}

      {step === "suggest-done" ? (
        <section className="hui-rise mt-6 space-y-5">
          <h1 className="hui-type-page-title text-foreground">Suggestion sent</h1>
          <HuiSurface tone="sage" shape="organic-alt" padding="md" className="space-y-1">
            {suggestSubmittedRange ? (
              <p className="text-lg font-extrabold text-foreground">{suggestSubmittedRange}</p>
            ) : null}
            <p className="text-sm font-semibold text-muted-foreground">
              The group still needs to agree on a time. Your own answer stays separate
              {viewerResponse ? ` (${participantAttendanceSummaryLabel(viewerResponse)}).` : " and is not set yet."}
            </p>
          </HuiSurface>
          <PendingButton type="button" size="touch" onClick={() => pushStep("time")}>
            Back to the proposed time
          </PendingButton>
        </section>
      ) : null}

      {step === "place" ? (
        <section className="hui-rise mt-6 space-y-5">
          <h1 className="hui-type-page-title text-foreground">Where it is</h1>
          <div className="overflow-hidden rounded-hui-xl bg-surface hui-shadow-md">
            <EventPlaceMap
              location={placeView.kind === "known" ? placeView.line : null}
              coordinates={placeView.kind === "known" ? coordinates : null}
              className={placeView.kind === "known" && coordinates ? "h-44" : "h-20"}
            />
            <div className="flex items-start gap-3 px-5 py-4">
              <PinIcon size={20} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-lg font-extrabold leading-snug text-foreground">{placeView.line}</p>
            </div>
          </div>
          <PendingButton type="button" size="touch" onClick={() => pushStep("bring")}>
            Continue
          </PendingButton>
        </section>
      ) : null}

      {step === "bring" ? (
        <section className="hui-rise mt-6 space-y-5">
          <div>
            <h1 className="hui-type-page-title text-foreground">What are you bringing?</h1>
            <p className="hui-type-supporting mt-2">Totally optional. Pick one if it helps the group.</p>
          </div>
          {secondaryError ? (
            <p className="hui-message-error" role="alert">
              {secondaryError}
            </p>
          ) : null}
          {!secondary && secondaryDataPromise ? (
            <div className="space-y-3" aria-busy="true">
              <div className="hui-skeleton h-20 !rounded-hui-xl" />
              <div className="hui-skeleton h-20 !rounded-hui-xl" />
            </div>
          ) : null}
          {secondary && categories.filter((c) => !c.archivedAt).length === 0 ? (
            <p className="hui-type-supporting">This group has no contribution categories to claim.</p>
          ) : null}
          {secondary && contributionSlots.length > 0 ? (
            <ul className="space-y-3">
              {contributionSlots.map((slot) => {
                const { category, contribution, state, statusLabel } = slot;
                const filled = isContributionSlotFilled(contribution);
                const isMine = state === "yours" || state === "host";
                return (
                  <li key={category.id}>
                    <HuiSurface
                      tone={isMine ? "sage" : filled ? "subtle" : "default"}
                      shape="soft"
                      padding="md"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
                        >
                          <BowlIcon size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-foreground">
                            {contributionCategoryHeadline(category.name, contribution ?? undefined)}
                          </p>
                          <p className="text-sm text-muted-foreground">{statusLabel}</p>
                        </div>
                      </div>
                      {!filled && canCoordinateContributions && !category.followsHost ? (
                        <div className="mt-3">
                          <AuthForm
                            action={claimContributionAction}
                            submitLabel={`Claim ${category.name}`}
                            hiddenFields={{
                              event_id: eventId,
                              group_id: groupId,
                              category_id: category.id,
                              category_name: category.name,
                            }}
                            refreshOnSuccess
                          >
                            <AuthField
                              label="What you're bringing (optional)"
                              name="description"
                              required={false}
                            />
                          </AuthForm>
                        </div>
                      ) : null}
                      {isMine ? (
                        <p className="hui-message-success mt-2">You&apos;re bringing this.</p>
                      ) : null}
                    </HuiSurface>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <PendingButton type="button" size="touch" onClick={() => pushStep("done")}>
            Done
          </PendingButton>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="hui-rise mt-6 space-y-5">
          <HuiSurface tone={chosenState === "no" ? "subtle" : "sage"} shape="organic" padding="lg" className="text-center">
            <div className="hui-pop mx-auto flex w-fit">
              <AttendanceDot state={chosenState} label={participantAttendanceSummaryLabel(viewerResponse ?? "available")} size="lg" />
            </div>
            <h1 className="hui-type-page-title mt-4 text-foreground">All set</h1>
            <p className="hui-type-supporting mt-1">Thanks — you&apos;re done for now.</p>
          </HuiSurface>
          <HuiSurface padding="md" shape="soft">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-bold text-muted-foreground">Time</dt>
                <dd className="text-right font-extrabold text-foreground">{timeLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-bold text-muted-foreground">Your answer</dt>
                <dd className="text-right font-extrabold text-foreground">
                  {viewerResponse ? participantAttendanceSummaryLabel(viewerResponse) : "No response yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-bold text-muted-foreground">Place</dt>
                <dd className="text-right font-extrabold text-foreground">{placeView.line}</dd>
              </div>
              {board.mine.map((c) => (
                <div key={c.id} className="flex justify-between gap-4">
                  <dt className="font-bold text-muted-foreground">You&apos;re bringing</dt>
                  <dd className="text-right font-extrabold text-foreground">
                    {c.categoryName ?? "Contribution"} — {c.label}
                  </dd>
                </div>
              ))}
              {board.stillNeeded.length > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-muted-foreground">Still needed</dt>
                  <dd className="text-right font-extrabold text-foreground">
                    {board.stillNeeded.map((c) => c.name).join(", ")}
                  </dd>
                </div>
              ) : null}
              {suggestSubmittedRange ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-muted-foreground">Suggested</dt>
                  <dd className="text-right font-extrabold text-foreground">{suggestSubmittedRange}</dd>
                </div>
              ) : null}
            </dl>
          </HuiSurface>
          <HuiLinkButton href={eventDetailPath(eventId)} variant="soft" size="touch">
            Back to the event
          </HuiLinkButton>
        </section>
      ) : null}
    </div>
  );
}
