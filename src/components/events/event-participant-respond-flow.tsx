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
import { PendingButton } from "@/components/ui/pending-button";
import { buildContributionBoard } from "@/domain/contributions/display";
import { formatCompactEventTimeRange, formatEventTimeRange } from "@/domain/datetime/timezone";
import {
  nextStepAfterAttendanceSave,
  participantFlowStepsForBack,
  type ParticipantFlowStep,
} from "@/domain/events/participant-flow";
import { participantPlaceView } from "@/domain/events/participant-place";
import { parseWallClockCandidate } from "@/domain/events/proposal";
import { availabilityResponseOptions } from "@/domain/scheduling/consensus-display";
import {
  participantAttendanceChoiceLabel,
  participantAttendanceSummaryLabel,
} from "@/domain/scheduling/participant-labels";
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
  hostingEnabled: boolean;
  viewerUserId: string;
  initialViewerResponse: AvailabilityChoice | null;
  secondaryDataPromise?: Promise<RespondSecondaryData>;
};

const choiceButtonBase =
  "w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition active:scale-[0.99] disabled:opacity-60";

function selectedChoiceClass(selected: boolean): string {
  return selected
    ? `${choiceButtonBase} border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900`
    : `${choiceButtonBase} border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900`;
}

function contributionBoardLine(
  categoryName: string,
  claimed: EventContributionRow | undefined,
): string {
  if (!claimed) {
    return `${categoryName} — Needed`;
  }
  return `${categoryName} — ${claimed.displayName ?? "Member"}`;
}

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
  viewerUserId,
  initialViewerResponse,
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
  const [timeEnd, setTimeEnd] = useState("15:00");
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
    secondaryDataPromise
      .then((data) => {
        if (!cancelled) {
          setSecondary(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecondaryError("Contribution details could not be loaded. Try again in a moment.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [secondaryDataPromise]);

  const board = useMemo(() => {
    const categories = secondary?.categories ?? [];
    const contributions = secondary?.contributions ?? [];
    return buildContributionBoard(categories, contributions, viewerUserId);
  }, [secondary, viewerUserId]);

  const categories = secondary?.categories ?? [];
  const contributions = secondary?.contributions ?? [];

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
      formData.set("ends_at", parsed.endsAt);
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

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {groupName}
        {" · "}
        <Link href={eventDetailPath(eventId)} className="underline-offset-4 hover:underline">
          Full event page
        </Link>
      </p>

      {showBack ? (
        <button
          type="button"
          onClick={goBack}
          className="mt-4 text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          Back
        </button>
      ) : null}

      {step === "time" ? (
        <section className="mt-6 space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{eventTitle}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{timeLabel}</p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
              Can you make this time?
            </p>
            <div className="mt-3 space-y-2">
              {attendanceOptions.map((option) => {
                const isSelected = viewerResponse === option;
                const isPending = pendingChoice === option && isSavingAttendance;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!canRespond || (isSavingAttendance && pendingChoice !== option)}
                    aria-pressed={isSelected}
                    aria-busy={isPending || undefined}
                    onClick={() => saveAttendance(option)}
                    className={selectedChoiceClass(isSelected)}
                  >
                    {isPending ? "Saving…" : participantAttendanceChoiceLabel(option)}
                  </button>
                );
              })}
              {canSuggestTime ? (
                <button
                  type="button"
                  className={selectedChoiceClass(false)}
                  onClick={() => openSuggestTime()}
                >
                  Suggest another time
                </button>
              ) : null}
            </div>
            {actionError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {actionError}
              </p>
            ) : null}
            {viewerResponse && !pendingChoice ? (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
                Saved: {participantAttendanceSummaryLabel(viewerResponse)}
              </p>
            ) : null}
            {viewerResponse === "available" || viewerResponse === "maybe" ? (
              <PendingButton
                type="button"
                className="mt-4 w-full"
                onClick={() => pushStep("place")}
              >
                Continue
              </PendingButton>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === "declined" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            You can&apos;t make this time.
          </h1>
          {viewerResponse ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Your response: {participantAttendanceSummaryLabel(viewerResponse)}
            </p>
          ) : null}
          <div className="space-y-2">
            {canSuggestTime ? (
              <PendingButton type="button" className="w-full" onClick={() => openSuggestTime()}>
                Suggest another time
              </PendingButton>
            ) : null}
            <PendingButton
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => pushStep("done")}
            >
              Done
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "suggest-time" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Suggest another time
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This adds a new candidate for the group to consider. It does not change your attendance
            response.
          </p>
          <WallClockDateField label="Date" value={timeDate} onChange={setTimeDate} />
          <WallClockTimeField label="Starts" value={timeStart} onChange={setTimeStart} />
          <WallClockTimeField label="Ends" value={timeEnd} onChange={setTimeEnd} />
          {suggestPreview ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{suggestPreview}</p>
          ) : null}
          {suggestError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {suggestError}
            </p>
          ) : null}
          <PendingButton
            type="button"
            className="w-full"
            pendingLabel="Submitting…"
            disabled={isSubmittingSuggest}
            onClick={submitSuggestedTime}
          >
            Submit suggestion
          </PendingButton>
        </section>
      ) : null}

      {step === "suggest-done" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Alternative time submitted
          </h1>
          {suggestSubmittedRange ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{suggestSubmittedRange}</p>
          ) : null}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The group still needs to agree on a time. Your attendance response stays separate.
          </p>
          {viewerResponse ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Your attendance: {participantAttendanceSummaryLabel(viewerResponse)}
            </p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No attendance response yet.</p>
          )}
          <PendingButton type="button" className="w-full" onClick={() => pushStep("time")}>
            Back to proposed time
          </PendingButton>
        </section>
      ) : null}

      {step === "place" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Place</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{placeView.line}</p>
          <PendingButton type="button" className="w-full" onClick={() => pushStep("bring")}>
            Continue
          </PendingButton>
        </section>
      ) : null}

      {step === "bring" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            What are you bringing?
          </h1>
          {secondaryError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {secondaryError}
            </p>
          ) : null}
          {!secondary && secondaryDataPromise ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ) : null}
          {secondary && categories.filter((c) => !c.archivedAt).length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This group has no contribution categories to claim.
            </p>
          ) : null}
          {secondary && categories.filter((c) => !c.archivedAt).length > 0 ? (
            <ul className="space-y-3">
              {categories
                .filter((c) => !c.archivedAt)
                .map((category) => {
                  const claimed = board.claimed.find((c) => c.categoryId === category.id);
                  const isMine = claimed?.userId === viewerUserId;
                  return (
                    <li
                      key={category.id}
                      className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {contributionBoardLine(category.name, claimed)}
                      </p>
                      {!claimed && canCoordinateContributions ? (
                        <div className="mt-2">
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
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                          You&apos;re bringing this.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          ) : null}
          <PendingButton type="button" className="w-full" onClick={() => pushStep("done")}>
            Done
          </PendingButton>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">All set</h1>
          <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <span className="text-zinc-500">Time:</span> {timeLabel}
            </li>
            <li>
              <span className="text-zinc-500">Attendance:</span>{" "}
              {viewerResponse
                ? participantAttendanceSummaryLabel(viewerResponse)
                : "No response yet"}
            </li>
            <li>
              <span className="text-zinc-500">Place:</span> {placeView.line}
            </li>
            {board.mine.map((c) => (
              <li key={c.id}>
                <span className="text-zinc-500">You:</span> {c.categoryName ?? "Contribution"} —{" "}
                {c.label}
              </li>
            ))}
            {board.stillNeeded.length > 0 ? (
              <li>
                <span className="text-zinc-500">Still needed:</span>{" "}
                {board.stillNeeded.map((c) => c.name).join(", ")}
              </li>
            ) : null}
          </ul>
          {suggestSubmittedRange ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Alternative suggested: {suggestSubmittedRange}
            </p>
          ) : null}
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            Thanks — you&apos;re done for now.
          </p>
        </section>
      ) : null}
    </div>
  );
}
