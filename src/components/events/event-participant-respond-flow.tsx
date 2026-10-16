"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import type { EventActionState } from "@/app/events/actions";
import {
  addCandidateAction,
  fetchConfirmAfterAvailabilitySaveAction,
  revalidateHomeGatheringSurfacesAction,
  setAvailabilityResponseAction,
} from "@/app/events/scheduling-actions";
import { claimContributionAction } from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import {
  WallClockDateField,
  WallClockTimeField,
} from "@/components/events/wall-clock-picker-field";
import { EventLifecycleLiveRefresh } from "@/components/events/event-lifecycle-live-refresh";
import { AttendanceChoice } from "@/components/hui/attendance-choice";
import { EventPlaceMap } from "@/components/hui/event-location-panel";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { ArrowLeftIcon, BowlIcon, ClockIcon, PinIcon } from "@/components/hui/icons";
import { PendingButton } from "@/components/ui/pending-button";
import { attendanceStateFromChoice } from "@/domain/events/home";
import { buildContributionBoard, formatViewerContributionLine } from "@/domain/contributions/display";
import {
  buildContributionSlots,
  contributionCategoryHeadline,
  isContributionSlotFilled,
  sortContributionSlotsForDisplay,
} from "@/domain/contributions/slots";
import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";
import { privateAttendanceNoteForCandidate } from "@/domain/events/private-attendance-note";
import { candidateIdsNeedingNoteFlushBeforeAdvance } from "@/domain/events/participant-respond-note-flush";
import type { EventStatus } from "@/domain/events/types";
import {
  multiTimeRespondSessionActive,
  nextStepAfterAttendanceSave,
  nextStepAfterPlace,
  participantFlowStepsForBack,
  proposedAttendanceCandidates,
  respondAttendanceCandidates,
  shouldShowParticipantBringStep,
  shouldShowParticipantPlaceStep,
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
import {
  attendanceActionErrorMessage,
  attendanceSaveCatchMessage,
  isAttendanceActionSuccess,
} from "@/domain/scheduling/availability-action-outcome";
import { isConfirmRaceNoRetryError } from "@/domain/scheduling/confirm-during-save";
import {
  participantDoneToastMessage,
  participantSaveToastMessage,
} from "@/domain/scheduling/participant-save-feedback";
import { createPerCandidateAttendanceSaveSerializers } from "@/lib/scheduling/serialize-attendance-saves";
import { markHostPromptDeferred } from "@/lib/events/defer-host-prompt";
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
import { useScrollTopOnStepChange } from "@/lib/ui/use-scroll-top-on-step-change";

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
  proposedCandidates: EventCandidateRow[];
  placeView: ReturnType<typeof participantPlaceView>;
  /** Hui's stored pin for the place, when the organiser set one. */
  coordinates: EventCoordinates | null;
  hostingEnabled: boolean;
  viewerUserId: string;
  initialViewerResponse: AvailabilityChoice | null;
  standingAvailabilityHint: StandingAvailabilityHint | null;
  secondaryDataPromise?: Promise<RespondSecondaryData>;
  /** Server-preformatted for hydration-safe display. */
  focusTimeLabel: string;
  candidateTimeLabels: Record<string, string>;
  replyByLabel: string | null;
  eventStatus: EventStatus;
};

const MAIN_FLOW_WITH_BRING: ParticipantFlowStep[] = ["time", "place", "bring", "done"];
const MAIN_FLOW_WITHOUT_BRING: ParticipantFlowStep[] = ["time", "place", "done"];

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
  proposedCandidates,
  placeView,
  coordinates,
  viewerUserId,
  initialViewerResponse,
  standingAvailabilityHint,
  secondaryDataPromise,
  focusTimeLabel,
  candidateTimeLabels,
  replyByLabel,
  eventStatus,
}: EventParticipantRespondFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<ParticipantFlowStep>("time");
  const [stepScrollEnabled, setStepScrollEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return readStepFromHash() === "time";
  });
  useScrollTopOnStepChange(step, { enabled: stepScrollEnabled });
  const [responseOverride, setResponseOverride] = useState<AvailabilityChoice | null>(null);
  const viewerResponse = responseOverride ?? initialViewerResponse;
  const [pinnedMultiTimeSession] = useState(() => {
    const active = multiTimeRespondSessionActive(proposedCandidates, eventStatus);
    const candidates = active
      ? proposedAttendanceCandidates(proposedCandidates)
      : respondAttendanceCandidates(proposedCandidates, eventStatus);
    return { active, candidates };
  });
  const attendanceCandidates = useMemo(() => {
    if (pinnedMultiTimeSession.active) {
      return pinnedMultiTimeSession.candidates;
    }
    return respondAttendanceCandidates(proposedCandidates, eventStatus);
  }, [
    pinnedMultiTimeSession.active,
    pinnedMultiTimeSession.candidates,
    proposedCandidates,
    eventStatus,
  ]);
  const [confirmedDuringVisit, setConfirmedDuringVisit] = useState<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    notice?: string;
  } | null>(null);
  const confirmedFromServer = useMemo(() => {
    if (eventStatus !== "confirmed") {
      return null;
    }
    const selected = proposedCandidates.find((row) => row.status === "selected");
    if (!selected) {
      return null;
    }
    return {
      id: selected.id,
      startsAt: selected.startsAt,
      endsAt: selected.endsAt,
    };
  }, [eventStatus, proposedCandidates]);
  const effectiveConfirmedVisit = confirmedDuringVisit ?? confirmedFromServer;
  const multipleTimeOptions = pinnedMultiTimeSession.active && effectiveConfirmedVisit === null;
  const [responsesByCandidate, setResponsesByCandidate] = useState<Record<string, AvailabilityChoice | null>>(
    () => {
      const initial: Record<string, AvailabilityChoice | null> = {};
      for (const row of attendanceCandidates) {
        initial[row.id] = row.viewerResponse;
      }
      return initial;
    },
  );
  const [persistedResponsesByCandidate, setPersistedResponsesByCandidate] = useState<
    Record<string, AvailabilityChoice | null>
  >(() => {
    const initial: Record<string, AvailabilityChoice | null> = {};
    for (const row of attendanceCandidates) {
      initial[row.id] = row.viewerResponse;
    }
    return initial;
  });
  const activeTimeCandidate = useMemo((): EventCandidateRow => {
    if (!effectiveConfirmedVisit) {
      return candidate;
    }
    const fromResponses = responsesByCandidate[effectiveConfirmedVisit.id];
    const fromProps =
      proposedCandidates.find((row) => row.id === effectiveConfirmedVisit.id)?.viewerResponse ??
      null;
    return {
      ...candidate,
      id: effectiveConfirmedVisit.id,
      startsAt: effectiveConfirmedVisit.startsAt,
      endsAt: effectiveConfirmedVisit.endsAt,
      status: "selected",
      viewerResponse: fromResponses ?? fromProps,
    };
  }, [candidate, effectiveConfirmedVisit, proposedCandidates, responsesByCandidate]);
  const [pendingByCandidate, setPendingByCandidate] = useState<
    Record<string, AvailabilityChoice | null>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [errorsByCandidate, setErrorsByCandidate] = useState<Record<string, string>>({});
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [savedCandidateFlash, setSavedCandidateFlash] = useState<Record<string, boolean>>({});
  const initialNotesByCandidate = (() => {
    const initial: Record<string, string> = {};
    for (const row of respondAttendanceCandidates(proposedCandidates, eventStatus)) {
      if (row.viewerPrivateNote) {
        initial[row.id] = row.viewerPrivateNote;
      }
    }
    return initial;
  })();
  const [noNote, setNoNote] = useState(() => candidate.viewerPrivateNote ?? "");
  const [noNotesByCandidate, setNoNotesByCandidate] =
    useState<Record<string, string>>(initialNotesByCandidate);
  const noteSaveTimersRef = useRef<Record<string, number>>({});
  const homeSurfacesRevalidateTimerRef = useRef<number | null>(null);
  const candidateSavePromisesRef = useRef<Record<string, Promise<void>>>({});
  const runSerializedAttendanceSaveRef = useRef(createPerCandidateAttendanceSaveSerializers());
  const lastAttemptedChoiceByCandidateRef = useRef<Record<string, AvailabilityChoice>>({});
  const responsesByCandidateRef = useRef(responsesByCandidate);
  const noNoteRef = useRef(candidate.viewerPrivateNote ?? "");
  const noNotesByCandidateRef = useRef<Record<string, string>>(initialNotesByCandidate);
  const [flushingNotes, setFlushingNotes] = useState(false);
  const [suggestSubmittedRange, setSuggestSubmittedRange] = useState<string | null>(null);
  const [timeDate, setTimeDate] = useState("");
  const [timeStart, setTimeStart] = useState("12:00");
  // The end time is optional: an empty value means "start only".
  const [timeEnd, setTimeEnd] = useState("");
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSubmittingSuggest, startSubmitSuggest] = useTransition();
  const [secondary, setSecondary] = useState<RespondSecondaryData | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  const scheduleHomeSurfacesRevalidate = useCallback(() => {
    if (homeSurfacesRevalidateTimerRef.current !== null) {
      window.clearTimeout(homeSurfacesRevalidateTimerRef.current);
    }
    homeSurfacesRevalidateTimerRef.current = window.setTimeout(() => {
      homeSurfacesRevalidateTimerRef.current = null;
      void revalidateHomeGatheringSurfacesAction(groupId);
    }, 400);
  }, [groupId]);

  useEffect(() => {
    return () => {
      if (homeSurfacesRevalidateTimerRef.current !== null) {
        window.clearTimeout(homeSurfacesRevalidateTimerRef.current);
      }
    };
  }, []);

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
          setSecondaryError("Bring list details could not be loaded. Try again in a moment.");
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

  const showBringStep = useMemo(
    () => shouldShowParticipantBringStep(contributionSlots),
    [contributionSlots],
  );

  const showPlaceStep = useMemo(
    () => shouldShowParticipantPlaceStep(placeView, showBringStep),
    [placeView, showBringStep],
  );

  const flowProgress = showBringStep ? MAIN_FLOW_WITH_BRING : MAIN_FLOW_WITHOUT_BRING;

  const timeLabel = focusTimeLabel;

  const suggestPreview = useMemo(() => {
    const parsed = parseWallClockCandidate(timeDate, timeStart, timeEnd, timeZone);
    if (!parsed) {
      return null;
    }
    return formatCompactEventTimeRange(parsed.startsAt, parsed.endsAt, timeZone);
  }, [timeDate, timeStart, timeEnd, timeZone]);
  const attendanceOptions = availabilityResponseOptions(maybeResponsesEnabled);

  const showSaveToast = useCallback((message: string) => {
    setSaveToast(message);
    window.setTimeout(() => setSaveToast(null), 4000);
  }, []);

  const applyConfirmedTransition = useCallback(
    (payload: {
      id: string;
      startsAt: string;
      endsAt: string | null;
      notice?: string;
    }) => {
      setConfirmedDuringVisit(payload);
      const saved = responsesByCandidateRef.current[payload.id];
      if (saved) {
        setResponseOverride(saved);
      }
      if (payload.notice) {
        showSaveToast(payload.notice);
      }
    },
    [showSaveToast],
  );

  const finishRespondFlow = useCallback(() => {
    showSaveToast(participantDoneToastMessage());
    router.push(`${eventDetailPath(eventId)}?saved=1`);
  }, [eventId, router, showSaveToast]);

  const pushStep = useCallback(
    (next: ParticipantFlowStep) => {
      let resolved = next;
      if (next === "bring" && !showBringStep) {
        resolved = "done";
      }
      if (resolved === "done") {
        markHostPromptDeferred(eventId);
        finishRespondFlow();
        return;
      }
      if (resolved === "place" || resolved === "declined") {
        markHostPromptDeferred(eventId);
      }
      setStep(resolved);
      window.history.pushState({ participantStep: resolved }, "", `#${resolved}`);
    },
    [eventId, finishRespondFlow, showBringStep],
  );

  const goBack = useCallback(() => {
    const previous = participantFlowStepsForBack(step, { showBringStep });
    if (!previous) {
      return;
    }
    setStep(previous);
    window.history.pushState({ participantStep: previous }, "", `#${previous}`);
  }, [step, showBringStep]);

  const pendingHashStepRef = useRef(false);

  useEffect(() => {
    const fromHash = readStepFromHash();
    if (fromHash === "time") {
      return;
    }
    pendingHashStepRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingHashStepRef.current) {
      return;
    }
    if (secondaryDataPromise && !secondary) {
      return;
    }
    pendingHashStepRef.current = false;
    const fromHash = readStepFromHash();
    const resolved =
      fromHash === "bring" && !showBringStep ? "done" : fromHash;
    // Defer so SSR/hydration first paint matches server ("time"), then apply deep-link hash.
    const id = window.requestAnimationFrame(() => {
      setStep(resolved);
      setStepScrollEnabled(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [secondary, secondaryDataPromise, showBringStep]);

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
      const previous = participantFlowStepsForBack(step, { showBringStep });
      if (previous) {
        setStep(previous);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step, showBringStep]);

  useEffect(() => {
    responsesByCandidateRef.current = responsesByCandidate;
  }, [responsesByCandidate]);

  useEffect(() => {
    const timers = noteSaveTimersRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const hasPendingAttendanceSave = Object.values(pendingByCandidate).some(
    (value) => value !== null && value !== undefined,
  );

  useEffect(() => {
    if (!hasPendingAttendanceSave) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPendingAttendanceSave]);

  function readNoteForCandidate(targetCandidateId: string): string {
    return privateAttendanceNoteForCandidate({
      multipleTimeOptions,
      candidateId: targetCandidateId,
      notesByCandidate: noNotesByCandidateRef.current,
      singleNote: noNoteRef.current,
    });
  }

  function clearNoteSaveTimer(targetCandidateId: string) {
    const existingTimer = noteSaveTimersRef.current[targetCandidateId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete noteSaveTimersRef.current[targetCandidateId];
    }
  }

  function saveAttendanceForCandidate(
    targetCandidateId: string,
    choice: AvailabilityChoice,
    advanceOnSave = true,
  ): Promise<void> {
    const inFlight = candidateSavePromisesRef.current[targetCandidateId];
    if (inFlight) {
      return inFlight.then(() =>
        saveAttendanceForCandidate(targetCandidateId, choice, advanceOnSave),
      );
    }
    if (!canRespond) {
      return Promise.resolve();
    }
    const existing = responsesByCandidateRef.current[targetCandidateId] ?? null;
    if (choice === existing) {
      if (choice === "unavailable") {
        // Note-only update after the user already answered no.
      } else if (advanceOnSave) {
        if (!multipleTimeOptions) {
          pushStep(nextStepAfterAttendanceSave(choice, { showPlaceStep }));
        }
        return Promise.resolve();
      } else {
        return Promise.resolve();
      }
    }
    const interaction = `attendance_${targetCandidateId}_${choice}`;
    beginInteraction(interaction);
    markInteraction(interaction, "handler-start");
    setActionError(null);
    setErrorsByCandidate((current) => {
      const next = { ...current };
      delete next[targetCandidateId];
      return next;
    });
    lastAttemptedChoiceByCandidateRef.current[targetCandidateId] = choice;
    setResponsesByCandidate((current) => ({ ...current, [targetCandidateId]: choice }));
    setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: choice }));
    if (!multipleTimeOptions) {
      setResponseOverride(choice);
    }
    const timeLabelForToast =
      candidateTimeLabels[targetCandidateId] ??
      (targetCandidateId === candidate.id ? focusTimeLabel : "");

    const savePromise = runSerializedAttendanceSaveRef.current(targetCandidateId, async () => {
      try {
        markInteraction(interaction, "request-start");
        const noteForSave = readNoteForCandidate(targetCandidateId);
        const formData = new FormData();
        formData.set("event_id", eventId);
        formData.set("candidate_id", targetCandidateId);
        formData.set("response", choice);
        if (choice === "unavailable") {
          formData.set("private_note", noteForSave);
        }
        const result: EventActionState = await setAvailabilityResponseAction({}, formData);
        markInteraction(interaction, "request-end");
        if (result.notice && !result.message) {
          if (multipleTimeOptions) {
            const message = result.notice;
            setErrorsByCandidate((current) => ({ ...current, [targetCandidateId]: message }));
            setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: null }));
            setResponsesByCandidate((current) => ({
              ...current,
              [targetCandidateId]: existing,
            }));
            endInteraction(interaction);
            return;
          }
          setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: null }));
          showSaveToast(result.notice);
          if (!multipleTimeOptions) {
            router.refresh();
          }
          endInteraction(interaction);
          return;
        }
        if (!isAttendanceActionSuccess(result)) {
          const message = attendanceActionErrorMessage(result);
          if (multipleTimeOptions) {
            setErrorsByCandidate((current) => ({ ...current, [targetCandidateId]: message }));
          } else {
            setActionError(message);
          }
          setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: null }));
          setResponsesByCandidate((current) => ({
            ...current,
            [targetCandidateId]: existing,
          }));
          endInteraction(interaction);
          return;
        }
        setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: null }));
        setPersistedResponsesByCandidate((current) => ({
          ...current,
          [targetCandidateId]: choice,
        }));
        scheduleHomeSurfacesRevalidate();
        if (multipleTimeOptions) {
          setSavedCandidateFlash((current) => ({ ...current, [targetCandidateId]: true }));
          window.setTimeout(() => {
            setSavedCandidateFlash((current) => {
              const next = { ...current };
              delete next[targetCandidateId];
              return next;
            });
          }, 3000);
        }
        if (result.confirmedCandidate) {
          applyConfirmedTransition({
            ...result.confirmedCandidate,
            notice: result.notice,
          });
        } else if (eventStatus === "proposing" && !multipleTimeOptions) {
          void fetchConfirmAfterAvailabilitySaveAction(eventId, groupId, timeZone).then(
            (confirm) => {
              if (confirm?.confirmedCandidate) {
                applyConfirmedTransition({
                  ...confirm.confirmedCandidate,
                  notice: confirm.notice,
                });
                return;
              }
              showSaveToast(participantSaveToastMessage(choice, timeLabelForToast));
            },
          );
        } else {
          showSaveToast(participantSaveToastMessage(choice, timeLabelForToast));
        }
        if (!multipleTimeOptions && advanceOnSave) {
          setResponseOverride(choice);
          pushStep(nextStepAfterAttendanceSave(choice, { showPlaceStep }));
          window.setTimeout(() => {
            router.refresh();
            endInteraction(interaction);
          }, 0);
        } else if (!multipleTimeOptions) {
          window.setTimeout(() => {
            router.refresh();
            endInteraction(interaction);
          }, 0);
        } else {
          endInteraction(interaction);
        }
      } catch (error) {
        const message = attendanceSaveCatchMessage(error);
        if (multipleTimeOptions) {
          setErrorsByCandidate((current) => ({ ...current, [targetCandidateId]: message }));
        } else {
          setActionError(message);
        }
        setPendingByCandidate((current) => ({ ...current, [targetCandidateId]: null }));
        setResponsesByCandidate((current) => ({
          ...current,
          [targetCandidateId]: existing,
        }));
        endInteraction(interaction);
      }
    });

    candidateSavePromisesRef.current[targetCandidateId] = savePromise;
    return savePromise.finally(() => {
      if (candidateSavePromisesRef.current[targetCandidateId] === savePromise) {
        delete candidateSavePromisesRef.current[targetCandidateId];
      }
    });
  }

  function choiceForRetry(targetCandidateId: string): AvailabilityChoice {
    return (
      lastAttemptedChoiceByCandidateRef.current[targetCandidateId] ??
      responsesByCandidate[targetCandidateId] ??
      "available"
    );
  }

  function saveAttendance(choice: AvailabilityChoice) {
    void saveAttendanceForCandidate(activeTimeCandidate.id, choice, choice !== "unavailable");
  }

  async function flushNoteSave(targetCandidateId: string): Promise<void> {
    clearNoteSaveTimer(targetCandidateId);
    const inFlight = candidateSavePromisesRef.current[targetCandidateId];
    if (inFlight) {
      await inFlight;
    }
    const choice =
      responsesByCandidateRef.current[targetCandidateId] ??
      (targetCandidateId === candidate.id ? viewerResponse : null);
    if (choice !== "unavailable") {
      return;
    }
    await saveAttendanceForCandidate(targetCandidateId, "unavailable", false);
  }

  async function flushNotesBeforeTimeStepAdvance(): Promise<void> {
    const ids = candidateIdsNeedingNoteFlushBeforeAdvance(
      responsesByCandidateRef.current,
      attendanceCandidates.map((row) => row.id),
    );
    for (const id of ids) {
      await flushNoteSave(id);
    }
  }

  async function advanceFromTimeStepAfterNotes(advance: () => void) {
    if (flushingNotes) {
      return;
    }
    setFlushingNotes(true);
    setActionError(null);
    try {
      await flushNotesBeforeTimeStepAdvance();
      advance();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not save your note. Try again.",
      );
    } finally {
      setFlushingNotes(false);
    }
  }

  function queueNoteSave(targetCandidateId: string) {
    clearNoteSaveTimer(targetCandidateId);
    noteSaveTimersRef.current[targetCandidateId] = window.setTimeout(() => {
      flushNoteSave(targetCandidateId);
    }, 500);
  }

  const multiAnsweredCount = attendanceCandidates.filter(
    (row) => persistedResponsesByCandidate[row.id] != null,
  ).length;

  const allMultiTimesAnswered =
    multipleTimeOptions &&
    attendanceCandidates.every((row) => responsesByCandidate[row.id] !== null);
  const multiSummaryChoice: AvailabilityChoice | null = (() => {
    if (!multipleTimeOptions) {
      return viewerResponse;
    }
    const values = attendanceCandidates
      .map((row) => responsesByCandidate[row.id])
      .filter((value): value is AvailabilityChoice => value !== null);
    if (values.some((value) => value === "available")) {
      return "available";
    }
    if (values.some((value) => value === "maybe")) {
      return "maybe";
    }
    if (values.length > 0 && values.every((value) => value === "unavailable")) {
      return "unavailable";
    }
    return null;
  })();

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
  const stepIndex = flowProgress.indexOf(step);
  const waitingForContributionContext = Boolean(secondaryDataPromise && !secondary);
  const chosenState = attendanceStateFromChoice(viewerResponse, maybeResponsesEnabled);

  return (
    <div className="mx-auto w-full max-w-md pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <EventLifecycleLiveRefresh eventId={eventId} status={eventStatus} />
      <header className="hui-rise flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="hui-type-label text-accent">{groupName}</p>
          <p className="mt-0.5 truncate text-lg font-extrabold leading-tight text-foreground">{eventTitle}</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{timeLabel}</p>
          {replyByLabel ? (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{replyByLabel}</p>
          ) : null}
        </div>
        <Link
          href={eventDetailPath(eventId)}
          className="hui-focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface px-4 text-sm font-extrabold text-foreground hui-shadow-sm"
        >
          Event
        </Link>
      </header>

      {stepIndex >= 0 ? (
        <div className="mt-5">
          <p className="text-sm font-extrabold text-foreground" id="respond-progress-label">
            {multipleTimeOptions
              ? `${multiAnsweredCount} of ${attendanceCandidates.length} times answered`
              : `Step ${stepIndex + 1} of ${flowProgress.length}`}
          </p>
          <ol className="mt-2 flex gap-1.5" aria-labelledby="respond-progress-label">
            {flowProgress.map((name, index) => (
              <li
                key={name}
                aria-current={index === stepIndex ? "step" : undefined}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  index <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </ol>
        </div>
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

      {saveToast ? (
        <p
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-hui-lg bg-foreground px-4 py-3 text-center text-sm font-semibold text-background hui-shadow-lg"
          role="status"
        >
          {saveToast}
        </p>
      ) : null}

      {step === "time" ? (
        <section className="hui-rise mt-6 space-y-5">
          {multipleTimeOptions ? (
            <>
              <h1 className="hui-type-page-title text-foreground">Can you make it?</h1>
              <p className="hui-type-supporting">
                {multiAnsweredCount} of {attendanceCandidates.length} answered — pick each time
                separately.
              </p>
              <ul className="space-y-4">
                {attendanceCandidates.map((row) => {
                  const rowResponse = responsesByCandidate[row.id] ?? null;
                  const rowPendingUnavailable = pendingByCandidate[row.id] === "unavailable";
                  return (
                    <li
                      key={row.id}
                      data-testid={`respond-time-row-${row.id}`}
                      aria-label={candidateTimeLabels[row.id] ?? "Proposed time"}
                      className="rounded-hui-xl bg-surface p-4 hui-shadow-sm"
                    >
                      <p className="text-sm font-extrabold text-foreground">
                        {candidateTimeLabels[row.id] ?? ""}
                      </p>
                      <p className="mt-1 min-h-[1.25rem] text-xs font-semibold text-muted-foreground">
                        {rowResponse ? (
                          <>
                            Your answer: {participantAttendanceSummaryLabel(rowResponse)}
                            {savedCandidateFlash[row.id] ? (
                              <span className="ml-2 text-accent">Saved</span>
                            ) : (
                              <span className="ml-2 invisible" aria-hidden="true">Saved</span>
                            )}
                          </>
                        ) : (
                          <span className="invisible" aria-hidden="true">Your answer: —</span>
                        )}
                      </p>
                      <div className="mt-3 space-y-2">
                        {attendanceOptions.map((option) => (
                          <AttendanceChoice
                            key={`${row.id}-${option}`}
                            state={attendanceStateFromChoice(option, true)}
                            label={participantAttendanceChoiceLabel(option)}
                            selected={rowResponse === option && rowResponse !== null}
                            pending={pendingByCandidate[row.id] === option}
                            disabled={!canRespond}
                            onClick={() => saveAttendanceForCandidate(row.id, option, false)}
                          />
                        ))}
                      </div>
                      {errorsByCandidate[row.id] ? (
                        <div className="mt-3 space-y-2" role="alert">
                          <p className="hui-message-error text-sm">{errorsByCandidate[row.id]}</p>
                          {!isConfirmRaceNoRetryError(errorsByCandidate[row.id]) ? (
                            <PendingButton
                              type="button"
                              size="sm"
                              variant="soft"
                              onClick={() => {
                                void saveAttendanceForCandidate(
                                  row.id,
                                  choiceForRetry(row.id),
                                  false,
                                );
                              }}
                            >
                              Retry
                            </PendingButton>
                          ) : null}
                        </div>
                      ) : null}
                      {rowResponse === "unavailable" || rowPendingUnavailable ? (
                        <label className="hui-label mt-3 block">
                          <span>Optional note (only if you want)</span>
                          <input
                            type="text"
                            name={`private_note_${row.id}`}
                            value={noNotesByCandidate[row.id] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setNoNotesByCandidate((current) => {
                                const next = { ...current, [row.id]: value };
                                noNotesByCandidateRef.current = next;
                                return next;
                              });
                              queueNoteSave(row.id);
                            }}
                            onBlur={() => flushNoteSave(row.id)}
                            maxLength={500}
                            className="hui-input"
                            placeholder="e.g. Away that weekend"
                          />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {actionError ? (
                <p className="hui-message-error" role="alert">
                  {actionError}
                </p>
              ) : null}
              {allMultiTimesAnswered && multiSummaryChoice ? (
                <PendingButton
                  type="button"
                  size="touch"
                  disabled={flushingNotes}
                  pendingLabel="Saving…"
                  onClick={() => {
                    void advanceFromTimeStepAfterNotes(() => {
                      setResponseOverride(multiSummaryChoice);
                      pushStep(
                        nextStepAfterAttendanceSave(multiSummaryChoice, { showPlaceStep }),
                      );
                    });
                  }}
                >
                  {flushingNotes ? "Saving…" : "Continue"}
                </PendingButton>
              ) : null}
            </>
          ) : (
            <>
          <h1 className="hui-type-page-title text-foreground">Can you make it?</h1>
          <p className="hui-type-supporting">
            Tap the option that fits — your answer saves straight away.
          </p>
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
              const isPending = pendingByCandidate[activeTimeCandidate.id] === option;
              const isSelected = viewerResponse === option && viewerResponse !== null;
              return (
                <AttendanceChoice
                  key={option}
                  state={attendanceStateFromChoice(option, true)}
                  label={participantAttendanceChoiceLabel(option)}
                  selected={isSelected}
                  pending={isPending}
                  disabled={!canRespond}
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
          {(viewerResponse === "unavailable" ||
            pendingByCandidate[activeTimeCandidate.id] === "unavailable") ? (
            <label className="hui-label block">
              <span>Optional note (only if you want)</span>
              <input
                type="text"
                name="private_note"
                value={noNote}
                onChange={(event) => {
                  const value = event.target.value;
                  setNoNote(value);
                  noNoteRef.current = value;
                  queueNoteSave(activeTimeCandidate.id);
                }}
                onBlur={() => flushNoteSave(activeTimeCandidate.id)}
                maxLength={500}
                className="hui-input"
                placeholder="e.g. Away that weekend"
              />
            </label>
          ) : null}
          {actionError ? (
            <p className="hui-message-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {viewerResponse === "available" || viewerResponse === "maybe" ? (
            <>
              {!canSuggestTime ? (
                <p className="text-sm font-semibold text-muted-foreground">
                  You already saved your answer — continue when you&apos;re ready to return to the
                  hui page.
                </p>
              ) : null}
              <PendingButton
                type="button"
                size="touch"
                onClick={() =>
                  pushStep(showPlaceStep ? "place" : nextStepAfterPlace(showBringStep))
                }
              >
                Continue
              </PendingButton>
            </>
          ) : null}
          {viewerResponse === "unavailable" ? (
            <PendingButton
              type="button"
              size="touch"
              disabled={flushingNotes}
              onClick={() => {
                void advanceFromTimeStepAfterNotes(() => {
                  pushStep(nextStepAfterAttendanceSave("unavailable", { showPlaceStep }));
                });
              }}
            >
              {flushingNotes ? "Saving…" : "Continue"}
            </PendingButton>
          ) : null}
            </>
          )}
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
          <PendingButton
            type="button"
            size="touch"
            disabled={waitingForContributionContext}
            onClick={() => pushStep(nextStepAfterPlace(showBringStep))}
          >
            {waitingForContributionContext ? "Loading…" : "Continue"}
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
            <p className="hui-type-supporting">
              This group has not set up what to bring yet.
            </p>
          ) : null}
          {secondary &&
          categories.filter((c) => !c.archivedAt).length > 0 &&
          contributionSlots.length === 0 ? (
            <p className="hui-type-supporting">
              Nothing specific was requested to bring for this gathering.
            </p>
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
                    {formatViewerContributionLine(c)}
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
