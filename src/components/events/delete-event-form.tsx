"use client";

import { useActionState, useState } from "react";

import { deleteEventAction, type EventActionState } from "@/app/events/actions";

const initialState: EventActionState = {};

export function DeleteEventForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteEventAction, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
      >
        Delete this hui
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-extrabold text-foreground">Delete this hui?</h4>
      <p className="text-sm font-semibold text-muted-foreground">
        This permanently removes this hui and its associated planning data. This cannot be undone.
      </p>
      {state.error ? (
        <p className="hui-message-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            disabled={pending}
            className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
          >
            {pending ? "Deleting…" : "Delete hui"}
          </button>
        </form>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
