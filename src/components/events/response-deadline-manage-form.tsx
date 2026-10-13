"use client";

import { useActionState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { updateEventResponseDeadlineAction } from "@/app/events/scheduling-actions";
import { PendingButton } from "@/components/ui/pending-button";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

type ResponseDeadlineManageFormProps = {
  eventId: string;
  defaultDeadlineLocal: string;
};

const initialState: EventActionState = {};

export function ResponseDeadlineManageForm({
  eventId,
  defaultDeadlineLocal,
}: ResponseDeadlineManageFormProps) {
  const [state, formAction] = useActionState(updateEventResponseDeadlineAction, initialState);
  useActionStateRefresh(state);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <label className="hui-label block">
        Reply deadline
        <input
          type="datetime-local"
          name="response_deadline_at"
          required
          defaultValue={defaultDeadlineLocal}
          className="hui-input mt-1 max-w-md"
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Members see this as the time they should reply by. Responses after the deadline are still
        accepted but marked late.
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
      <PendingButton type="submit" variant="secondary" size="sm" pendingLabel="Saving…">
        Save reply deadline
      </PendingButton>
    </form>
  );
}
