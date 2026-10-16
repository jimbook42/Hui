"use client";

import { useActionState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { nudgeEventAvailabilityAction } from "@/app/events/scheduling-actions";
import { PendingButton } from "@/components/ui/pending-button";
import { formatClockTime, formatShortDay } from "@/domain/datetime/display";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

type AvailabilityNudgeButtonProps = {
  eventId: string;
  timeZone: string;
  lastNudgeAt: string | null;
};

const initialState: EventActionState = {};

function nextNudgeAvailableAt(lastNudgeAt: string | null): Date | null {
  if (!lastNudgeAt) {
    return null;
  }
  const next = new Date(lastNudgeAt);
  next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
  if (next.getTime() <= Date.now()) {
    return null;
  }
  return next;
}

export function AvailabilityNudgeButton({
  eventId,
  timeZone,
  lastNudgeAt,
}: AvailabilityNudgeButtonProps) {
  const [state, formAction] = useActionState(nudgeEventAvailabilityAction, initialState);
  useActionStateRefresh(state);

  const rateLimitedUntil = nextNudgeAvailableAt(lastNudgeAt);
  const rateLimited = Boolean(rateLimitedUntil);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      {rateLimitedUntil ? (
        <p className="text-sm text-muted-foreground">
          Next nudge available {formatShortDay(rateLimitedUntil.toISOString(), timeZone)}{" "}
          {formatClockTime(rateLimitedUntil.toISOString(), timeZone)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Remind members who have not answered any proposed time yet.
        </p>
      )}
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
      <PendingButton
        type="submit"
        variant="secondary"
        size="sm"
        pendingLabel="Sending…"
        disabled={rateLimited}
      >
        Nudge
      </PendingButton>
    </form>
  );
}
