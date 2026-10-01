"use client";

import { useActionState } from "react";

import type { EventActionState } from "@/app/events/actions";
import {
  addCandidateAction,
  setAvailabilityResponseAction,
  withdrawCandidateAction,
} from "@/app/events/scheduling-actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { AvailabilityChoice } from "@/domain/scheduling/types";
import { availabilityLabel } from "@/lib/scheduling/labels";
import type { EventCandidateRow } from "@/lib/scheduling/types";

type EventSchedulingProps = {
  eventId: string;
  groupId: string;
  candidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  canAddCandidates: boolean;
  canRemoveCandidates: boolean;
  canRespond: boolean;
};

const initialState: EventActionState = {};

function formatSlot(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${start.toLocaleString()} — ${end.toLocaleTimeString()}`;
  }
  return `${start.toLocaleString()} — ${end.toLocaleString()}`;
}

const responseOptions = (
  maybeEnabled: boolean,
): { value: AvailabilityChoice; label: string }[] => {
  const options: { value: AvailabilityChoice; label: string }[] = [
    { value: "available", label: availabilityLabel("available") },
    { value: "unavailable", label: availabilityLabel("unavailable") },
  ];
  if (maybeEnabled) {
    options.push({ value: "maybe", label: availabilityLabel("maybe") });
  }
  return options;
};

function CandidateResponseForm({
  eventId,
  candidate,
  maybeResponsesEnabled,
  canRespond,
}: {
  eventId: string;
  candidate: EventCandidateRow;
  maybeResponsesEnabled: boolean;
  canRespond: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setAvailabilityResponseAction,
    initialState,
  );
  const options = responseOptions(maybeResponsesEnabled);

  if (!canRespond) {
    return candidate.viewerResponse ? (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your response: {availabilityLabel(candidate.viewerResponse)}
      </p>
    ) : (
      <p className="text-sm text-zinc-500">No response recorded.</p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidate.id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Your availability</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
              candidate.viewerResponse === option.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
            }`}
          >
            <input
              type="radio"
              name="response"
              value={option.value}
              className="sr-only"
              defaultChecked={candidate.viewerResponse === option.value}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
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

export function EventScheduling({
  eventId,
  groupId,
  candidates,
  maybeResponsesEnabled,
  minimumAttendees,
  canAddCandidates,
  canRemoveCandidates,
  canRespond,
}: EventSchedulingProps) {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Candidate times
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Propose date and time options, then share your private availability. The group
        needs at least {minimumAttendees} attendee
        {minimumAttendees === 1 ? "" : "s"} before a time can be confirmed later.
      </p>

      {canAddCandidates ? (
        <div className="mt-6 max-w-lg">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Add a candidate
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
          <li className="text-sm text-zinc-500">No candidate times yet.</li>
        ) : (
          candidates.map((candidate) => (
            <li
              key={candidate.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {formatSlot(candidate.startsAt, candidate.endsAt)}
              </p>
              <CandidateResponseForm
                eventId={eventId}
                candidate={candidate}
                maybeResponsesEnabled={maybeResponsesEnabled}
                canRespond={canRespond}
              />
              {canRemoveCandidates ? (
                <WithdrawCandidateButton eventId={eventId} candidateId={candidate.id} />
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
