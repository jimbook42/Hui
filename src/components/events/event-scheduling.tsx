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
    <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/60">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">Attendance</p>
      {namedGroups.length > 0 ? (
        <div className="mt-2 space-y-2 text-zinc-600 dark:text-zinc-400">
          {namedGroups.map((group) => (
            <div key={group.label}>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{group.label}</p>
              <p>{group.names.join(", ")}</p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-1 list-inside list-disc text-zinc-600 dark:text-zinc-400">
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
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {consensusRuleRequirementSummary(evaluation.consensusRule, {
          minimumAttendees: evaluation.minimumAttendees,
          eligibleMemberCount: evaluation.eligibleMemberCount,
          requiredParticipantCount: evaluation.requiredParticipantCount,
        })}
      </p>
      {evaluation.consensusRule === "required_participants" &&
      evaluation.requiredParticipantCount > 0 ? (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {evaluation.requiredAcceptedCount} of {evaluation.requiredParticipantCount}{" "}
          required participants available.
        </p>
      ) : null}
    </div>
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
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Your response:{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {availabilityLabel(candidate.viewerResponse)}
        </span>
      </p>
    ) : (
      <p className="mt-3 text-sm text-zinc-500">No response recorded.</p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidate.id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Your availability
        </legend>
        {options.map((option) => (
          <label
            key={option}
            className={`mt-2 cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
              candidate.viewerResponse === option
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
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
      <label className="block text-sm text-zinc-700 dark:text-zinc-300">
        Reason (optional, private)
        <textarea
          name="private_note"
          rows={2}
          maxLength={500}
          defaultValue={candidate.viewerPrivateNote ?? ""}
          placeholder="Only you can see this note"
          className="mt-1 block w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
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
    <form action={formAction} className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <p className="text-sm text-emerald-900 dark:text-emerald-200">
        Confirming selects this time and locks further candidate and availability changes.
      </p>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidateId} />
      {state.error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
      <p className="mt-2 text-sm text-zinc-500">
        This time was withdrawn and no longer accepts responses.
      </p>
    );
  }

  if (eventStatus === "confirmed" && candidate.status === "selected") {
    return (
      <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
        This is the confirmed time for the event.
      </p>
    );
  }
  if (eventStatus === "confirmed") {
    return (
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Not selected. This time can no longer change the outcome.
      </p>
    );
  }
  if (!evaluation) {
    return (
      <p className="mt-2 text-sm text-zinc-500">
        Consensus summary is not available for this time.
      </p>
    );
  }

  if (hasNoResponsesYet(evaluation)) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
            ? "text-sm text-emerald-800 dark:text-emerald-300"
            : "text-sm text-zinc-600 dark:text-zinc-400"
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
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-red-700 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-400"
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
      className={`rounded-lg border p-4 ${
        candidate.status === "selected"
          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {formatSlot(candidate.startsAt, candidate.endsAt, timeZone)}
        </p>
        {badge ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              badge === "Confirmed time" || badge === "Meets requirements"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                : badge === "Withdrawn"
                  ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Scheduling and consensus
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Share your availability for each candidate time. Attendance status is visible to the
        group; private notes stay private. Group rule:{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{ruleLabel}</span>
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
        <p className="mt-2 text-sm text-zinc-500">{deadlineNotice}</p>
      ) : null}
      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{sectionMessage}</p>

      {canAddCandidates ? (
        <div className="mt-6 max-w-lg">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
          <li className="text-sm text-zinc-500">
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
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
