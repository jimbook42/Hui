"use client";

import { useActionState, useState } from "react";

import { cancelEventAction, type EventActionState } from "@/app/events/actions";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: EventActionState = {};

export function CancelEventButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(cancelEventAction, initialState);
  useActionStateRefresh(state);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hui-btn hui-btn-danger mt-4 rounded-full hui-focus-ring"
      >
        Cancel event
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-extrabold text-foreground">Cancel this hui?</p>
      <p className="text-sm font-semibold text-muted-foreground">
        The hui stays in history as cancelled. This cannot be undone from here.
      </p>
      <form action={formAction}>
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
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
          >
            {pending ? "Cancelling…" : "Yes, cancel hui"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
          >
            Keep hui
          </button>
        </div>
      </form>
    </div>
  );
}
