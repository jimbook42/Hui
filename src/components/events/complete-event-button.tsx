"use client";

import { useActionState } from "react";

import { completeEventAction, type EventActionState } from "@/app/events/actions";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: EventActionState = {};

export function CompleteEventButton({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(completeEventAction, initialState);
  useActionStateRefresh(state);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="event_id" value={eventId} />
      {state.error ? (
        <p className="hui-message-error mb-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="hui-message-success mb-2" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring"
      >
        {pending ? "Completing…" : "Mark hui completed"}
      </button>
    </form>
  );
}
