"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { setAvailabilityResponseAction } from "@/app/events/scheduling-actions";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { GatheringVisual } from "@/components/hui/gathering-visual";
import { HuiButton, HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { attendanceStateFromChoice, viewerStatusLabel } from "@/domain/events/home";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  applyViewerOverrideToRoster,
  effectiveViewerResponse,
  responseChangeEffect,
  type ViewerOverride,
} from "@/domain/scheduling/attendance-override";
import { availabilityResponseOptions } from "@/domain/scheduling/consensus-display";
import { participantAttendanceChoiceLabel } from "@/domain/scheduling/participant-labels";
import type { AvailabilityChoice } from "@/domain/scheduling/types";
import { participantRespondPath } from "@/lib/events/paths";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";
import { cn } from "@/lib/ui/cn";

type AttendanceLiveValue = {
  override: ViewerOverride | null;
  setOverride: (value: ViewerOverride | null) => void;
};

const AttendanceLiveContext = createContext<AttendanceLiveValue | null>(null);

/**
 * Shares the viewer's optimistic answer between the answer card and the gathering visual so that
 * both change the instant they tap — without waiting for the server (HUI-026P).
 */
export function AttendanceLiveProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ViewerOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <AttendanceLiveContext.Provider value={value}>{children}</AttendanceLiveContext.Provider>;
}

function useAttendanceLive(): AttendanceLiveValue {
  const context = useContext(AttendanceLiveContext);
  if (!context) {
    // Outside a provider (e.g. a list view) nothing is optimistic: behave as a plain read.
    return { override: null, setOverride: () => undefined };
  }
  return context;
}

type LiveGatheringVisualProps = {
  roster: AttendanceRoster;
  viewerUserId: string;
  eventTitle?: string;
  className?: string;
  compact?: boolean;
  hideCounts?: boolean;
};

/** `GatheringVisual` that reflects the viewer's pending answer immediately. */
export function LiveGatheringVisual({ roster, viewerUserId, ...rest }: LiveGatheringVisualProps) {
  const { override } = useAttendanceLive();
  const live = useMemo(
    () => applyViewerOverrideToRoster(roster, viewerUserId, override),
    [roster, viewerUserId, override],
  );
  return <GatheringVisual roster={live} {...rest} />;
}

const SHORT_LABEL: Record<AvailabilityChoice, string> = {
  available: "Yes",
  maybe: "Maybe",
  unavailable: "No",
};

type ViewerResponseCardProps = {
  eventId: string;
  /** The time the answer applies to (the selected time once confirmed). */
  candidateId: string;
  /** What the server currently has for the viewer. */
  serverResponse: AvailabilityChoice | null;
  maybeResponsesEnabled: boolean;
  confirmed: boolean;
  /** Viewer has claimed something to bring (so declining releases it). */
  hasContribution: boolean;
  /** Viewer is the accepted host (declining needs a conversation, not just a tap). */
  isAcceptedHost: boolean;
};

/**
 * The viewer's own answer, always visible, with an obvious way to change it. Changing to Maybe or
 * No saves immediately; Yes also saves immediately and then points at place + what to bring.
 * First answers (still pending) go through the existing guided flow.
 */
export function ViewerResponseCard({
  eventId,
  candidateId,
  serverResponse,
  maybeResponsesEnabled,
  confirmed,
  hasContribution,
  isAcceptedHost,
}: ViewerResponseCardProps) {
  const router = useRouter();
  const panelId = useId();
  const { override, setOverride } = useAttendanceLive();
  const [open, setOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<AvailabilityChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<AvailabilityChoice | null>(null);
  const [isSaving, startSaving] = useTransition();

  const response = effectiveViewerResponse(serverResponse, override);
  const state = attendanceStateFromChoice(response, maybeResponsesEnabled);
  const pending = state === "pending";
  const options = availabilityResponseOptions(maybeResponsesEnabled);

  function save(choice: AvailabilityChoice) {
    if (isSaving || choice === response) {
      return;
    }
    const interaction = `attendance_${choice}`;
    beginInteraction(interaction);
    markInteraction(interaction, "handler-start");
    setError(null);
    setFollowUp(null);
    setPendingChoice(choice);
    setOverride({ choice, basedOn: serverResponse });
    markInteraction(interaction, "optimistic-ui-visible");
    markInteraction(interaction, "usable-ui");

    startSaving(async () => {
      markInteraction(interaction, "request-start");
      const formData = new FormData();
      formData.set("event_id", eventId);
      formData.set("candidate_id", candidateId);
      formData.set("response", choice);
      const result = await setAvailabilityResponseAction({}, formData);
      markInteraction(interaction, "request-end");
      setPendingChoice(null);
      if (result.error) {
        // Roll back to what the server still has.
        setOverride(null);
        setError(result.error);
        endInteraction(interaction);
        return;
      }
      setFollowUp(choice);
      setOpen(false);
      markInteraction(interaction, "navigation-start");
      // One refresh reconciles everything derived from the answer (counts, consensus, host and
      // contribution sections). The optimistic UI above has already updated.
      router.refresh();
      markInteraction(interaction, "navigation-end");
      endInteraction(interaction);
    });
  }

  const effect = followUp ? responseChangeEffect(null, followUp) : null;

  return (
    <HuiSurface
      tone={state === "yes" ? "sage" : state === "no" ? "subtle" : "clay"}
      shape="organic-alt"
      padding="md"
    >
      <div className="flex items-center gap-4">
        <AttendanceDot state={state} label={viewerStatusLabel(state)} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="hui-type-label text-muted-foreground">Your answer</p>
          <p className="text-lg font-extrabold leading-tight text-foreground" role="status">
            {isSaving && pendingChoice ? "Saving\u2026" : viewerStatusLabel(state)}
          </p>
          {pending ? (
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
              {confirmed
                ? "Let the group know if you can make it."
                : "The group is waiting to hear from you."}
            </p>
          ) : null}
        </div>
      </div>

      {pending ? (
        <HuiLinkButton
          href={participantRespondPath(eventId)}
          variant="primary"
          shape="melt"
          size="touch"
          className="mt-4 w-full"
        >
          Reply
        </HuiLinkButton>
      ) : (
        <>
          <HuiButton
            variant="secondary"
            shape="melt"
            size="touch"
            className="mt-4 w-full"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Keep my answer" : "Change response"}
          </HuiButton>

          <div id={panelId} hidden={!open} className="mt-3">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Change your answer">
              {options.map((option) => {
                const selected = response === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    disabled={isSaving}
                    onClick={() => save(option)}
                    title={participantAttendanceChoiceLabel(option)}
                    className={cn(
                      "hui-focus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-hui-xl px-2 py-2 text-sm font-extrabold transition duration-200 active:scale-[0.97] disabled:opacity-60",
                      selected
                        ? "bg-primary text-primary-foreground hui-shadow-md"
                        : "bg-surface text-foreground hui-shadow-sm",
                    )}
                  >
                    <AttendanceDot
                      state={attendanceStateFromChoice(option, true)}
                      label={participantAttendanceChoiceLabel(option)}
                      size="xs"
                      hideBadge
                    />
                    <span>{SHORT_LABEL[option]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {error ? (
        <p className="hui-message-error mt-3" role="alert">
          {error}
        </p>
      ) : null}

      {!pending && followUp && !error ? (
        <div className="mt-3 space-y-2 text-sm font-semibold text-muted-foreground" role="status">
          {effect === "offer-details" ? (
            <p>
              You&apos;re in.{" "}
              <Link
                href={`${participantRespondPath(eventId)}#place`}
                className="hui-focus-ring font-extrabold text-accent underline underline-offset-4"
              >
                Check the place and choose what to bring
              </Link>
              .
            </p>
          ) : (
            <p>Answer updated. The group can see it now.</p>
          )}
        </div>
      ) : null}

      {!pending && response === "unavailable" && hasContribution ? (
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Anything you had agreed to bring is released so someone else can pick it up.
        </p>
      ) : null}

      {!pending && response === "unavailable" && isAcceptedHost ? (
        <p className="hui-message-note mt-3">
          You&apos;re the host. If you can&apos;t make it, open Hosting below to ask for a swap.
        </p>
      ) : null}
    </HuiSurface>
  );
}
