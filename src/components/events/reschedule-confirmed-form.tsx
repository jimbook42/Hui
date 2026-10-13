"use client";

import { useActionState, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import {
  reopenConfirmedEventAction,
  rescheduleConfirmedToTimeAction,
} from "@/app/events/reschedule-actions";
import { PendingButton } from "@/components/ui/pending-button";
import { formatDateTimeLocalInTimeZone } from "@/domain/datetime/timezone";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: EventActionState = {};

type RescheduleConfirmedFormProps = {
  eventId: string;
  timeZone: string;
  defaultStartsAt: string;
  defaultEndsAt: string | null;
};

export function RescheduleConfirmedForm({
  eventId,
  timeZone,
  defaultStartsAt,
  defaultEndsAt,
}: RescheduleConfirmedFormProps) {
  const [timeStep, setTimeStep] = useState<"idle" | "confirm">("idle");
  const [reopenStep, setReopenStep] = useState<"idle" | "confirm">("idle");
  const [timeState, timeAction, timePending] = useActionState(
    rescheduleConfirmedToTimeAction,
    initialState,
  );
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenConfirmedEventAction,
    initialState,
  );
  useActionStateRefresh(timeState);
  useActionStateRefresh(reopenState);

  const startsLocal = formatDateTimeLocalInTimeZone(defaultStartsAt, timeZone);
  const endsLocal = defaultEndsAt
    ? formatDateTimeLocalInTimeZone(defaultEndsAt, timeZone)
    : "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          Pick a new confirmed time. Attendance answers are cleared and members are notified to
          respond again. Hosting and bring assignments stay as they are.
        </p>
        {timeStep === "idle" ? (
          <button
            type="button"
            className="hui-btn hui-btn-secondary mt-4 rounded-full hui-focus-ring"
            onClick={() => setTimeStep("confirm")}
          >
            Change date and time
          </button>
        ) : (
          <form action={timeAction} className="mt-4 max-w-lg space-y-3">
            <input type="hidden" name="event_id" value={eventId} />
            <label className="hui-label block">
              <span>New start</span>
              <input
                type="datetime-local"
                name="starts_at"
                className="hui-input"
                required
                defaultValue={startsLocal}
              />
            </label>
            <label className="hui-label block">
              <span>New end (optional)</span>
              <input
                type="datetime-local"
                name="ends_at"
                className="hui-input"
                defaultValue={endsLocal}
              />
            </label>
            {timeState.error ? (
              <p className="hui-message-error" role="alert">{timeState.error}</p>
            ) : null}
            {timeState.message ? (
              <p className="hui-message-note" role="status">{timeState.message}</p>
            ) : null}
            <p className="text-sm font-semibold text-muted-foreground">
              Everyone will need to answer attendance again for the new time.
            </p>
            <div className="flex flex-wrap gap-3">
              <PendingButton type="submit" variant="secondary" disabled={timePending}>
                {timePending ? "Rescheduling…" : "Confirm reschedule"}
              </PendingButton>
              <button
                type="button"
                className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
                disabled={timePending}
                onClick={() => setTimeStep("idle")}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="border-t border-border/60 pt-6">
        <p className="text-sm font-semibold text-muted-foreground">
          Or reopen the hui to proposing so you can add new candidate times.
        </p>
        {reopenStep === "idle" ? (
          <button
            type="button"
            className="hui-btn hui-btn-secondary mt-4 rounded-full hui-focus-ring"
            onClick={() => setReopenStep("confirm")}
          >
            Reopen for new times
          </button>
        ) : (
          <form action={reopenAction} className="mt-4 space-y-3">
            <input type="hidden" name="event_id" value={eventId} />
            {reopenState.error ? (
              <p className="hui-message-error" role="alert">{reopenState.error}</p>
            ) : null}
            {reopenState.message ? (
              <p className="hui-message-note" role="status">{reopenState.message}</p>
            ) : null}
            <p className="text-sm font-semibold text-muted-foreground">
              The confirmed time is cleared. Members are notified; add times from scheduling
              after reopening.
            </p>
            <div className="flex flex-wrap gap-3">
              <PendingButton type="submit" variant="soft" disabled={reopenPending}>
                {reopenPending ? "Reopening…" : "Confirm reopen"}
              </PendingButton>
              <button
                type="button"
                className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
                disabled={reopenPending}
                onClick={() => setReopenStep("idle")}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
