"use client";

import { useActionState } from "react";

import { finaliseEventAction } from "@/app/events/scheduling-actions";
import type { EventActionState } from "@/app/events/actions";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: EventActionState = {};

export function ConfirmThisTimeButton({
  eventId,
  candidateId,
  requireExtraConfirm,
  className,
}: {
  eventId: string;
  candidateId: string;
  requireExtraConfirm?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(finaliseEventAction, initialState);
  useActionStateRefresh(state);

  return (
    <form
      action={formAction}
      className={className}
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
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="candidate_id" value={candidateId} />
      {requireExtraConfirm ? <input type="hidden" name="force_confirm" value="1" /> : null}
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
        className="hui-btn hui-btn-primary hui-btn-sm rounded-full hui-focus-ring"
      >
        {pending ? "Confirming…" : "Confirm this time"}
      </button>
    </form>
  );
}
