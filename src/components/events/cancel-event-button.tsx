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
        <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        {pending ? "Cancelling…" : "Cancel event"}
      </button>
    </form>
  );
}
