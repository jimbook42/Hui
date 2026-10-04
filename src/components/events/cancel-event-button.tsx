"use client";

import { useActionState } from "react";

import { cancelEventAction, type EventActionState } from "@/app/events/actions";

const initialState: EventActionState = {};

export function CancelEventButton({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(cancelEventAction, initialState);

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
        className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
      >
        {pending ? "Cancelling…" : "Cancel event"}
      </button>
    </form>
  );
}
