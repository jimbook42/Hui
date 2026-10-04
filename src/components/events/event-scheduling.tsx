"use client";

import { useActionState } from "react";

import type { EventActionState } from "@/app/events/actions";
import {
  addCandidateAction,
  finaliseEventAction,
  setAvailabilityResponseAction,
  withdrawCandidateAction,
} from "@/app/events/scheduling-actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { EventStatus } from "@/domain/events/types";
import {
  availabilityResponseOptions,
  buildAttendanceSummaryLines,
  candidateStatusBadge,
  consensusRuleRequirementSummary,
  eventSchedulingSectionMessage,
  hasNoResponsesYet,
  isCandidateOpenForResponses,
  proposalDeadlineGroupNotice,
  shouldShowFinaliseControl,
} from "@/domain/scheduling/consensus-display";
import {
  availabilityLabel,
  consensusFailureLabel,
  consensusRuleLabel,
} from "@/lib/scheduling/labels";
import { formatEventTimeRange } from "@/domain/datetime/timezone";
import {
  groupAttendanceByResponse,
  type AttendanceRoster,
} from "@/domain/scheduling/attendance-roster";
import type {
  CandidateConsensusView,
  EventCandidateRow,
  EventConsensusSummary,
} from "@/lib/scheduling/types";
import { GatheringVisual } from "@/components/hui/gathering-visual";
import { AttendanceLegend } from "@/components/hui/attendance-legend";
import { HuiSurface } from "@/components/hui/hui-surface";

type EventSchedulingProps = {
  eventId: string;
  groupId: string;
  eventStatus: EventStatus;
  candidates: EventCandidateRow[];
  withdrawnCandidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  proposalDeadlineHours: number | null;
  consensus: EventConsensusSummary;
  canAddCandidates: boolean;
  canRemoveCandidates: boolean;
  canRespond: boolean;
  canFinalise: boolean;
  timeZone: string;
  attendanceRosters: Record<string, AttendanceRoster>;
};

const initialState: EventActionState = {};

function formatSlot(startsAt: string, endsAt: string, timeZone: string): string {
  return formatEventTimeRange(startsAt, endsAt, timeZone);
}

function AttendanceSummary({
  evaluation,
  maybeResponsesEnabled,
  roster,
}: {
  evaluation: CandidateConsensusView;
  maybeResponsesEnabled: boolean;
  roster?: AttendanceRoster | null;
}) {
  const namedGroups = roster ? groupAttendanceByResponse(roster) : [];

  return (
    <HuiSurface className="mt-3" padding="sm">
      <p className="hui-type-section text-foreground">Attendance</p>
      {roster && roster.members.length > 0 ? (
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
              <p>{group.names.join(", ")}</p>
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
        {consensusRuleRequirementSummary(evaluation.consensusRule, {
          minimumAttendees: evaluation.minimumAttendees,
          eligibleMemberCount: evaluation.eligibleMemberCount,
          requiredParticipantCount: evaluation.requiredParticipantCount,
        })}
      </p>
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
      {state.message ? (
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
}: {
  eventId: string;
  candidateId: string;
}) {
  const [state, formAction, pending] = useActionState(finaliseEventAction, initialState);

  return (
    <form action={formAction} className="mt-4 rounded-hui-sm bg-sage-soft p-3">
      <p className="hui-message-success">
        Confirming selects this time and locks further candidate and availability changes.
      </p>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidateId} />
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
  maybeResponsesEnabled,
  roster,
}: {
  eventStatus: EventStatus;
  candidate: EventCandidateRow;
  evaluation: CandidateConsensusView | undefined;
  maybeResponsesEnabled: boolean;
  roster?: AttendanceRoster | null;
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
          maybeResponsesEnabled={maybeResponsesEnabled}
          roster={roster}
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
        maybeResponsesEnabled={maybeResponsesEnabled}
        roster={roster}
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

function CandidateCard({
  eventId,
  eventStatus,
  candidate,
  evaluation,
  maybeResponsesEnabled,
  canRespond,
  canRemoveCandidates,
  canFinalise,
  timeZone,
  roster,
}: {
  eventId: string;
  eventStatus: EventStatus;
  candidate: EventCandidateRow;
  evaluation: CandidateConsensusView | undefined;
  maybeResponsesEnabled: boolean;
  canRespond: boolean;
  canRemoveCandidates: boolean;
  canFinalise: boolean;
  timeZone: string;
  roster?: AttendanceRoster | null;
}) {
  const badge = candidateStatusBadge(
    eventStatus,
    candidate.status,
    evaluation?.passes ?? false,
  );

  return (
    <li
      className={`rounded-hui-lg p-4 ${
        candidate.status === "selected" ? "bg-sage-soft" : "bg-muted"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-bold text-foreground">
          {formatSlot(candidate.startsAt, candidate.endsAt, timeZone)}
        </p>
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
      <CandidateConsensusNote
        eventStatus={eventStatus}
        candidate={candidate}
        evaluation={evaluation}
        maybeResponsesEnabled={maybeResponsesEnabled}
        roster={roster}
      />
      {candidate.status !== "withdrawn" ? (
        <CandidateResponseForm
          eventId={eventId}
          eventStatus={eventStatus}
          candidate={candidate}
          maybeResponsesEnabled={maybeResponsesEnabled}
          canRespond={canRespond}
        />
      ) : null}
      {shouldShowFinaliseControl(
        canFinalise,
        eventStatus,
        candidate.status,
        evaluation?.passes ?? false,
      ) ? (
        <FinaliseCandidateButton eventId={eventId} candidateId={candidate.id} />
      ) : null}
      {canRemoveCandidates && candidate.status === "proposed" ? (
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
  consensus,
  canAddCandidates,
  canRemoveCandidates,
  canRespond,
  canFinalise,
  timeZone,
  attendanceRosters,
}: EventSchedulingProps) {
  const evaluations = new Map(
    consensus.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const passingCount = consensus.candidates.filter((candidate) => candidate.passes).length;
  const requiredCount = consensus.candidates[0]?.requiredParticipantCount ?? 0;
  const ruleLabel = consensusRuleLabel(consensus.consensusRule);
  const deadlineNotice = proposalDeadlineGroupNotice(proposalDeadlineHours);
  const sectionMessage = eventSchedulingSectionMessage(
    eventStatus,
    passingCount,
    canFinalise,
  );

  return (
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Scheduling and consensus
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Share your availability for each candidate time. Attendance status is visible to the
        group; private notes stay private. Group rule:{" "}
        <span className="font-medium text-foreground">{ruleLabel}</span>
        .{" "}
        {consensusRuleRequirementSummary(consensus.consensusRule, {
          minimumAttendees,
          eligibleMemberCount: consensus.eligibleMemberCount,
          requiredParticipantCount: requiredCount,
        })}
        {consensus.maybeResponsesEnabled
          ? " Maybe counts as available."
          : " Maybe does not count as available."}
      </p>
      {deadlineNotice ? (
        <p className="mt-2 text-sm text-muted-foreground">{deadlineNotice}</p>
      ) : null}
      <p className="mt-3 text-sm text-foreground">{sectionMessage}</p>

      {canAddCandidates ? (
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
              <AuthField label="Ends" name="ends_at" type="datetime-local" required />
            </AuthForm>
          </div>
        </div>
      ) : null}

      <ul className="mt-8 space-y-6">
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
              maybeResponsesEnabled={maybeResponsesEnabled}
              canRespond={canRespond}
              canRemoveCandidates={canRemoveCandidates}
              canFinalise={canFinalise}
              timeZone={timeZone}
              roster={attendanceRosters[candidate.id] ?? null}
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
                maybeResponsesEnabled={maybeResponsesEnabled}
                canRespond={false}
                canRemoveCandidates={false}
                canFinalise={false}
                timeZone={timeZone}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
