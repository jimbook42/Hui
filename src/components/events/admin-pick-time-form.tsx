"use client";

import { useActionState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { adminFinaliseEventAction } from "@/app/events/scheduling-actions";
import { PendingButton } from "@/components/ui/pending-button";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

type AdminPickTimeFormProps = {
  eventId: string;
  candidates: { id: string; label: string }[];
};

const initialState: EventActionState = {};

export function AdminPickTimeForm({ eventId, candidates }: AdminPickTimeFormProps) {
  const [state, formAction] = useActionState(adminFinaliseEventAction, initialState);
  useActionStateRefresh(state);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <label className="hui-label block">
        Proposed time
        <select name="candidate_id" required defaultValue="" className="hui-input mt-1 max-w-md">
          <option value="" disabled>
            Choose a time
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Confirms immediately for the group as an admin pick. The host must have said Yes to that
        time.
      </p>
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
      <PendingButton type="submit" variant="secondary" size="sm" pendingLabel="Confirming…">
        Confirm this time
      </PendingButton>
    </form>
  );
}
