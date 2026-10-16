"use client";

import { useActionState, useMemo, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import {
  addCandidateAction,
  finaliseEventAction,
  setAvailabilityResponseAction,
  withdrawCandidateAction,
} from "@/app/events/scheduling-actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { EventStatus } from "@/domain/events/types";
import { isPassedProposedCandidate } from "@/domain/scheduling/candidate-start-past";
import {
  availabilityResponseOptions,
  buildAttendanceSummaryLines,
  candidateStatusBadge,
  eventConfirmRuleRequirementSummary,
  eventSchedulingSectionMessage,
  hasNoResponsesYet,
  isCandidateOpenForResponses,
  isWaitingOnHostFailure,
  proposalDeadlineGroupNotice,
  shouldOfferOrganiserConfirm,
  shouldShowFinaliseControl,
  WAITING_ON_HOST_STATUS_MESSAGE,
} from "@/domain/scheduling/consensus-display";
import type { EventConfirmRule } from "@/domain/events/confirm-rule";
import { eventConfirmRuleLabel } from "@/domain/events/confirm-rule";
import { availabilityLabel, consensusFailureLabel } from "@/lib/scheduling/labels";
import {
  groupAttendanceByResponse,
  type AttendanceRoster,
} from "@/domain/scheduling/attendance-roster";
import type {
  CandidateConsensusView,
  EventCandidateRow,
  EventConsensusSummary,
} from "@/lib/scheduling/types";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";
import { perTimeAvailabilityRowLabel } from "@/domain/scheduling/per-time-availability";
import { GatheringVisual } from "@/components/hui/gathering-visual";
import { AttendanceLegend } from "@/components/hui/attendance-legend";
import { HuiSurface } from "@/components/hui/hui-surface";
import { acceptHostProposalAction } from "@/app/hosts/actions";
import { AcceptHostWithPlaceForm } from "@/components/hosts/accept-host-with-place-form";
import { HostSwapRequestForm } from "@/components/hosts/host-swap-request-form";
import type { EventCoordinates } from "@/domain/events/location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";

type EventSchedulingProps = {
  eventId: string;
  groupId: string;
  eventStatus: EventStatus;
  candidates: EventCandidateRow[];
  withdrawnCandidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  proposalDeadlineHours: number | null;
  replyByLabel: string | null;
  consensus: EventConsensusSummary;
  canAddCandidates: boolean;
  canRemoveCandidates: boolean;
  canRespond: boolean;
  canFinalise: boolean;
  timeZone: string;
  /** Server-preformatted labels keyed by candidate id (avoids hydration mismatches). */
  candidateTimeLabels: Record<string, string>;
  attendanceRosters: Record<string, AttendanceRoster>;
  perTimeHosting?: {
    canAcceptHost: boolean;
    canRequestSwap: boolean;
    hostSwapHasReplacement: boolean;
    suggestedHostName: string | null;
    hostingEnabled: boolean;
    hostPlaceRequired: boolean | null;
    defaultLocation: string | null;
    defaultCoordinates: EventCoordinates | null;
    viewerHomeLocation: ProfileHomeLocation | null;
    acceptedHostDisplayName: string | null;
  } | null;
  /** When true, use compact per-time rows even for a single proposed or confirmed time. */
  forceCompactTimeList?: boolean;
  /** Main hui page shows only the time list; full controls stay under Details. */
  timesOnlySurface?: boolean;
};

const initialState: EventActionState = {};

function AttendanceSummary({
  evaluation,
  confirmRule,
  maybeResponsesEnabled,
  roster,
  showLateTags,
  listLayout,
}: {
  evaluation: CandidateConsensusView;
  confirmRule: EventConfirmRule;
  maybeResponsesEnabled: boolean;
  roster?: AttendanceRoster | null;
  showLateTags?: boolean;
  listLayout?: boolean;
}) {
  const namedGroups = roster
    ? groupAttendanceByResponse(roster, { showLateTags })
    : [];

  return (
    <HuiSurface className="mt-3" padding="sm">
      <p className="hui-type-section text-foreground">Attendance</p>
      {roster && roster.members.length > 0 && !listLayout ? (
        <GatheringVisual
          roster={roster}
          eventTitle="This time"
          compact
          className="mt-3"
        />
      ) : null}
      <AttendanceLegend maybeEnabled={maybeResponsesEnabled} />
      {namedGroups.length > 0 ? (
        <div className="mt-2 space-y-2 text-muted-foreground">
          {namedGroups.map((group) => (
            <div key={group.label}>
              <p className="font-medium text-foreground">{group.label}</p>
              {group.entries && showLateTags ? (
                <ul className="mt-1 space-y-1">
                  {group.entries.map((entry) => (
                    <li key={entry.displayName} className="flex flex-wrap items-center gap-2">
                      <span>{entry.displayName}</span>
                      {entry.submittedLate ? (
                        <span
                          className="rounded-full bg-clay-soft px-2 py-0.5 text-xs font-medium text-foreground"
                        >
                          Late
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{group.names.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-1 list-inside list-disc text-muted-foreground">
          {buildAttendanceSummaryLines({
            acceptedCount: evaluation.acceptedCount,
            maybeCount: evaluation.maybeCount,
            unavailableCount: evaluation.unavailableCount,
            noResponseCount: evaluation.noResponseCount,
            maybeResponsesEnabled,
          }).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-muted-foreground">
        {eventConfirmRuleRequirementSummary(confirmRule, {
          minimumAttendees: evaluation.minimumAttendees,
          eligibleMemberCount: evaluation.eligibleMemberCount,
        })}
      </p>
      {isWaitingOnHostFailure(evaluation.failureReason) ? (
        <p className="mt-2 text-sm font-semibold text-foreground" role="status">
          {WAITING_ON_HOST_STATUS_MESSAGE}
        </p>
      ) : null}
      {evaluation.consensusRule === "required_participants" &&
      evaluation.requiredParticipantCount > 0 ? (
        <p className="mt-1 text-muted-foreground">
          {evaluation.requiredAcceptedCount} of {evaluation.requiredParticipantCount}{" "}
          required participants available.
        </p>
      ) : null}
    </HuiSurface>
  );
}

function CandidateResponseForm({
  eventId,
  eventStatus,
  candidate,
  maybeResponsesEnabled,
  canRespond,
}: {
  eventId: string;
  eventStatus: EventStatus;
  candidate: EventCandidateRow;
  maybeResponsesEnabled: boolean;
  canRespond: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setAvailabilityResponseAction,
    initialState,
  );
  useActionStateRefresh(state);
  const options = availabilityResponseOptions(maybeResponsesEnabled);
  const open = canRespond && isCandidateOpenForResponses(eventStatus, candidate.status);

  if (!open) {
    return candidate.viewerResponse ? (
      <p className="mt-3 text-sm text-muted-foreground">
        Your response:{" "}
        <span className="font-medium text-foreground">
          {availabilityLabel(candidate.viewerResponse)}
        </span>
      </p>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">No response recorded.</p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidate.id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-sm font-bold text-foreground">
          Your availability
        </legend>
        {options.map((option) => (
          <label
            key={option}
            className={`mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent-primary)] ${
              candidate.viewerResponse === option
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <input
              type="radio"
              name="response"
              value={option}
              className="sr-only"
              defaultChecked={candidate.viewerResponse === option}
            />
            {availabilityLabel(option)}
          </label>
        ))}
      </fieldset>
      <label className="hui-label">
        Reason (optional, private)
        <textarea
          name="private_note"
          rows={2}
          maxLength={500}
          defaultValue={candidate.viewerPrivateNote ?? ""}
          placeholder="Only you can see this note"
          className="hui-input max-w-md"
        />
      </label>
      {state.error ? (
        <p className="hui-message-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="hui-message-success" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.message && !state.notice ? (
        <p className="hui-message-success" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-secondary hui-btn-sm rounded-full hui-focus-ring"
      >
        {pending ? "Saving…" : "Save response"}
      </button>
    </form>
  );
}

function FinaliseCandidateButton({
  eventId,
  candidateId,
  requireExtraConfirm,
}: {
  eventId: string;
  candidateId: string;
  requireExtraConfirm?: boolean;
}) {
  const [state, formAction, pending] = useActionState(finaliseEventAction, initialState);
  useActionStateRefresh(state);

  return (
    <form
      action={formAction}
      className="mt-4 rounded-hui-sm bg-sage-soft p-3"
      onSubmit={(event) => {
        if (
          requireExtraConfirm &&
          !window.confirm(
            "This time does not meet the group rules yet. Confirm only if you are sure everyone who needs to be included has said Yes.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <p className="hui-message-success">
        Confirming selects this time and locks further candidate and availability changes.
      </p>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidateId} />
      {requireExtraConfirm ? (
        <input type="hidden" name="force_confirm" value="1" />
      ) : null}
      {state.error ? (
        <p className="hui-message-error mt-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="hui-message-success mt-2" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-primary hui-btn-sm rounded-full hui-focus-ring mt-3"
      >
        {pending ? "Confirming…" : "Confirm this time"}
      </button>
    </form>
  );
}

function CandidateConsensusNote({
  eventStatus,
  candidate,
  evaluation,
  confirmRule,
  maybeResponsesEnabled,
  roster,
  showLateTags,
  listLayout,
}: {
  eventStatus: EventStatus;
  candidate: EventCandidateRow;
  evaluation: CandidateConsensusView | undefined;
  confirmRule: EventConfirmRule;
  maybeResponsesEnabled: boolean;
  roster?: AttendanceRoster | null;
  showLateTags?: boolean;
  listLayout?: boolean;
}) {
  if (candidate.status === "withdrawn") {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        This time was withdrawn and no longer accepts responses.
      </p>
    );
  }

  if (eventStatus === "confirmed" && candidate.status === "selected") {
    return (
      <p className="hui-message-success mt-2">
        This is the confirmed time for the event.
      </p>
    );
  }
  if (eventStatus === "confirmed") {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Not selected. This time can no longer change the outcome.
      </p>
    );
  }
  if (!evaluation) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Consensus summary is not available for this time.
      </p>
    );
  }

  if (hasNoResponsesYet(evaluation)) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-sm text-muted-foreground">
          Waiting for the first responses.
        </p>
        <AttendanceSummary
          evaluation={evaluation}
          confirmRule={confirmRule}
          maybeResponsesEnabled={maybeResponsesEnabled}
          roster={roster}
          showLateTags={showLateTags}
          listLayout={listLayout}
        />
      </div>
    );
  }

  const outcome = evaluation.passes
    ? "Meets the group's requirements."
    : evaluation.failureReason
      ? consensusFailureLabel(evaluation.failureReason, evaluation)
      : "Does not meet the group's requirements yet.";

  return (
    <div className="mt-2 space-y-2">
      <p
        className={
          evaluation.passes
            ? "hui-message-success"
            : "text-sm text-muted-foreground"
        }
      >
        {outcome}
      </p>
      <AttendanceSummary
        evaluation={evaluation}
        confirmRule={confirmRule}
        maybeResponsesEnabled={maybeResponsesEnabled}
        roster={roster}
        showLateTags={showLateTags}
        listLayout={listLayout}
      />
    </div>
  );
}

function WithdrawCandidateButton({
  eventId,
  candidateId,
}: {
  eventId: string;
  candidateId: string;
}) {
  const [state, formAction, pending] = useActionState(
    withdrawCandidateAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidateId} />
      {state.error ? (
        <p className="hui-message-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-link-danger inline-flex min-h-11 items-center text-sm"
      >
        {pending ? "Removing…" : "Remove candidate"}
      </button>
    </form>
  );
}

function PerTimeExpandedHosting({
  eventId,
  hosting,
}: {
  eventId: string;
  hosting: NonNullable<EventSchedulingProps["perTimeHosting"]>;
}) {
  if (!hosting.canAcceptHost && !hosting.canRequestSwap && !hosting.acceptedHostDisplayName) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4" data-testid="per-time-host-actions">
      {hosting.acceptedHostDisplayName ? (
        <p className="text-sm font-semibold text-foreground">
          Host: {hosting.acceptedHostDisplayName}
        </p>
      ) : hosting.suggestedHostName ? (
        <p className="text-sm text-muted-foreground">
          Suggested host: {hosting.suggestedHostName}
        </p>
      ) : null}
      {hosting.canAcceptHost || hosting.canRequestSwap ? (
        <div className="flex flex-wrap gap-3">
          {hosting.canAcceptHost ? (
            <AcceptHostWithPlaceForm
              action={acceptHostProposalAction}
              eventId={eventId}
              hostingEnabled={hosting.hostingEnabled}
              hostPlaceRequired={hosting.hostPlaceRequired}
              defaultLocation={hosting.defaultLocation}
              defaultCoordinates={hosting.defaultCoordinates}
              suggestedHostName={hosting.suggestedHostName ?? "You"}
              viewerHomeLocation={hosting.viewerHomeLocation}
            />
          ) : null}
          {hosting.canRequestSwap ? (
            <HostSwapRequestForm
              eventId={eventId}
              hasReplacement={hosting.hostSwapHasReplacement}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CandidateCard({
  eventId,
  eventStatus,
  candidate,
  evaluation,
  confirmRule,
  maybeResponsesEnabled,
  canRespond,
  canRemoveCandidates,
  canFinalise,
  timeLabel,
  roster,
  showLateTags,
  listLayout,
  expanded,
  onToggle,
  perTimeHosting,
}: {
  eventId: string;
  eventStatus: EventStatus;
  candidate: EventCandidateRow;
  evaluation: CandidateConsensusView | undefined;
  confirmRule: EventConfirmRule;
  maybeResponsesEnabled: boolean;
  canRespond: boolean;
  canRemoveCandidates: boolean;
  canFinalise: boolean;
  timeLabel: string;
  roster?: AttendanceRoster | null;
  showLateTags?: boolean;
  listLayout?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  perTimeHosting?: EventSchedulingProps["perTimeHosting"];
}) {
  const nowIso = new Date().toISOString();
  const passed = isPassedProposedCandidate(candidate, nowIso);
  const badge = passed
    ? "Passed"
    : candidateStatusBadge(eventStatus, candidate.status, evaluation?.passes ?? false);

  const rowSummary =
    evaluation && listLayout ? perTimeAvailabilityRowLabel(evaluation) : null;

  return (
    <li
      className={`rounded-hui-lg p-4 ${
        passed
          ? "bg-muted opacity-60"
          : candidate.status === "selected"
            ? "bg-sage-soft"
            : "bg-muted"
      }`}
    >
      {listLayout && onToggle ? (
        <button
          type="button"
          className="hui-focus-ring flex w-full items-start justify-between gap-3 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
            {timeLabel}
            {passed ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                Passed
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">
            {passed ? "No longer available" : (rowSummary ?? "No responses yet")}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-bold text-foreground">{timeLabel}</p>
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                badge === "Confirmed time" || badge === "Meets requirements"
                  ? "bg-sage-soft text-success"
                  : badge === "Withdrawn"
                    ? "bg-muted text-foreground"
                    : "bg-muted text-foreground"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
      )}
      {listLayout && expanded === false ? null : (
      <CandidateConsensusNote
        eventStatus={eventStatus}
        candidate={candidate}
        evaluation={evaluation}
        confirmRule={confirmRule}
        maybeResponsesEnabled={maybeResponsesEnabled}
        roster={roster}
        showLateTags={showLateTags}
        listLayout={listLayout}
      />
      )}
      {(!listLayout || expanded !== false) && candidate.status !== "withdrawn" && !passed ? (
        <CandidateResponseForm
          eventId={eventId}
          eventStatus={eventStatus}
          candidate={candidate}
          maybeResponsesEnabled={maybeResponsesEnabled}
          canRespond={canRespond}
        />
      ) : null}
      {listLayout && expanded !== false && perTimeHosting ? (
        <PerTimeExpandedHosting eventId={eventId} hosting={perTimeHosting} />
      ) : null}
      {(!listLayout || expanded !== false) && shouldShowFinaliseControl(
        canFinalise && !passed,
        eventStatus,
        candidate.status,
        evaluation?.passes ?? false,
        {
          confirmRule,
          yesCount: evaluation?.yesCount ?? 0,
          failureReason: evaluation?.failureReason,
        },
      ) ? (
        <FinaliseCandidateButton eventId={eventId} candidateId={candidate.id} />
      ) : shouldOfferOrganiserConfirm(
          canFinalise,
          eventStatus,
          candidate.status,
          evaluation?.yesCount ?? 0,
          evaluation?.passes ?? false,
        ) && confirmRule !== "organiser_picks" ? (
        <FinaliseCandidateButton
          eventId={eventId}
          candidateId={candidate.id}
          requireExtraConfirm
        />
      ) : null}
      {(!listLayout || expanded !== false) && canRemoveCandidates && candidate.status === "proposed" ? (
        <WithdrawCandidateButton eventId={eventId} candidateId={candidate.id} />
      ) : null}
    </li>
  );
}

export function EventScheduling({
  eventId,
  groupId,
  eventStatus,
  candidates,
  withdrawnCandidates,
  maybeResponsesEnabled,
  minimumAttendees,
  proposalDeadlineHours,
  replyByLabel,
  consensus,
  canAddCandidates,
  canRemoveCandidates,
  canRespond,
  canFinalise,
  timeZone,
  candidateTimeLabels,
  attendanceRosters,
  perTimeHosting = null,
  forceCompactTimeList = false,
  timesOnlySurface = false,
}: EventSchedulingProps) {
  const evaluations = new Map(
    consensus.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const passingCount = consensus.candidates.filter((candidate) => candidate.passes).length;
  const confirmRuleLabel = eventConfirmRuleLabel(consensus.confirmRule);
  const deadlineNotice = proposalDeadlineGroupNotice(proposalDeadlineHours);
  void timeZone;
  const sectionMessage = eventSchedulingSectionMessage(
    eventStatus,
    passingCount,
    canFinalise,
  );
  const useCompactTimeList = forceCompactTimeList || candidates.length > 1;
  const defaultExpandedCandidateId = useMemo(() => {
    if (!useCompactTimeList) {
      return null;
    }
    const nowIso = new Date().toISOString();
    return (
      candidates.find((candidate) => !isPassedProposedCandidate(candidate, nowIso))?.id ?? null
    );
  }, [candidates, useCompactTimeList]);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null | undefined>(
    undefined,
  );
  const resolvedExpandedCandidateId =
    expandedCandidateId !== undefined ? expandedCandidateId : defaultExpandedCandidateId;

  return (
    <section className={timesOnlySurface ? undefined : "hui-card-section"}>
      {timesOnlySurface ? null : (
        <>
          <h2 className="hui-type-section text-foreground">Finding a time</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Share your availability for each time on the table. Your answer is visible to the group;
            private notes stay private.
          </p>
          <details className="hui-details mt-3 rounded-hui-lg bg-muted px-4 py-2">
            <summary className="hui-focus-ring cursor-pointer text-sm font-extrabold text-foreground">
              Advanced — how confirmation works
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              This hui: <span className="font-medium text-foreground">{confirmRuleLabel}</span>.{" "}
              {eventConfirmRuleRequirementSummary(consensus.confirmRule, {
                minimumAttendees,
                eligibleMemberCount: consensus.eligibleMemberCount,
              })}{" "}
              {consensus.maybeResponsesEnabled
                ? consensus.confirmRule === "when_most_can_come"
                  ? "Maybe can help reach the minimum number needed, but only Yes counts toward the majority."
                  : "Maybe can help reach the minimum number needed."
                : "Only Yes counts toward confirmation."}
            </p>
          </details>
          {replyByLabel ? (
            <p className="mt-2 text-sm font-semibold text-foreground">{replyByLabel}</p>
          ) : null}
          {deadlineNotice ? (
            <p className="mt-2 text-sm text-muted-foreground">{deadlineNotice}</p>
          ) : null}
          <p className="mt-3 text-sm text-foreground">{sectionMessage}</p>
        </>
      )}

      {timesOnlySurface && replyByLabel ? (
        <p className="mb-3 text-sm font-semibold text-muted-foreground">{replyByLabel}</p>
      ) : null}

      {!timesOnlySurface && canAddCandidates ? (
        <div className="mt-6 max-w-lg">
          <h3 className="text-sm font-bold text-foreground">
            Add a candidate time
          </h3>
          <div className="mt-3">
            <AuthForm
              action={addCandidateAction}
              submitLabel="Add candidate"
              hiddenFields={{ event_id: eventId, group_id: groupId }}
            >
              <AuthField label="Starts" name="starts_at" type="datetime-local" required />
              <AuthField
                label="Ends (optional)"
                name="ends_at"
                type="datetime-local"
                required={false}
              />
            </AuthForm>
          </div>
        </div>
      ) : null}

      <ul className={timesOnlySurface ? "space-y-3" : "mt-8 space-y-6"}>
        {candidates.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            No candidate times yet.
            {canAddCandidates
              ? " Add a time above to start collecting availability."
              : " The proposer can add times while the event is proposing."}
          </li>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              eventId={eventId}
              eventStatus={eventStatus}
              candidate={candidate}
              evaluation={evaluations.get(candidate.id)}
              confirmRule={consensus.confirmRule}
              maybeResponsesEnabled={maybeResponsesEnabled}
              canRespond={canRespond}
              canRemoveCandidates={canRemoveCandidates}
              canFinalise={canFinalise}
              timeLabel={candidateTimeLabels[candidate.id] ?? ""}
              roster={attendanceRosters[candidate.id] ?? null}
              showLateTags={canFinalise}
              listLayout={useCompactTimeList}
              expanded={!useCompactTimeList || resolvedExpandedCandidateId === candidate.id}
              onToggle={
                useCompactTimeList
                  ? () =>
                      setExpandedCandidateId((current) => {
                        const active =
                          current !== undefined ? current : defaultExpandedCandidateId;
                        return active === candidate.id ? null : candidate.id;
                      })
                  : undefined
              }
              perTimeHosting={perTimeHosting}
            />
          ))
        )}
      </ul>

      {withdrawnCandidates.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-sm font-bold text-foreground">
            Withdrawn times
          </h3>
          <ul className="mt-4 space-y-4">
            {withdrawnCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                eventId={eventId}
                eventStatus={eventStatus}
                candidate={candidate}
                evaluation={undefined}
                confirmRule={consensus.confirmRule}
                maybeResponsesEnabled={maybeResponsesEnabled}
                canRespond={false}
                canRemoveCandidates={false}
                canFinalise={false}
                timeLabel={candidateTimeLabels[candidate.id] ?? ""}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
