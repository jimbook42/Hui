"use client";

import { useActionState } from "react";

import {
  setRecurrencePausedAction,
  skipPlanningCycleAction,
  type PlanningCycleActionState,
} from "@/app/groups/planning-cycle-actions";
import { pickOpenCycleNominalDate } from "@/domain/recurrence/planning-cycle";
import type { GroupPlanningContext } from "@/lib/groups/planning-cycle-queries";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: PlanningCycleActionState = {};

export function GroupRecurrenceAdminControls({ context }: { context: GroupPlanningContext }) {
  const [pauseState, pauseAction, pausePending] = useActionState(
    setRecurrencePausedAction,
    initialState,
  );
  const [skipState, skipAction, skipPending] = useActionState(
    skipPlanningCycleAction,
    initialState,
  );
  useActionStateRefresh(pauseState);
  useActionStateRefresh(skipState);

  if (!context.canManageRecurrence) {
    return null;
  }

  const defaultSkipDate = pickOpenCycleNominalDate(context.cycle) ?? "";

  return (
    <div className="mt-6 space-y-6 border-t border-border/60 pt-6">
      <div>
        <p className="hui-type-label text-muted-foreground">Admin</p>
        <form action={pauseAction} className="mt-3">
          <input type="hidden" name="group_id" value={context.groupId} />
          <input
            type="hidden"
            name="paused"
            value={context.recurrencePaused ? "0" : "1"}
          />
          {pauseState.error ? (
            <p className="hui-message-error mb-2" role="alert">{pauseState.error}</p>
          ) : null}
          {pauseState.message ? (
            <p className="hui-message-success mb-2" role="status">{pauseState.message}</p>
          ) : null}
          <button
            type="submit"
            disabled={pausePending}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring text-sm"
          >
            {pausePending
              ? "Saving…"
              : context.recurrencePaused
                ? "Resume recurrence"
                : "Pause recurrence"}
          </button>
        </form>
      </div>

      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          Skip one nominal cycle (visible to the group)
        </p>
        <form key={defaultSkipDate} action={skipAction} className="mt-3 space-y-3">
          <input type="hidden" name="group_id" value={context.groupId} />
          <label className="block text-sm font-semibold text-foreground">
            Nominal date
            <input
              type="date"
              name="nominal_date"
              defaultValue={defaultSkipDate}
              required
              className="mt-1 hui-input w-full max-w-xs"
            />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Reason (optional)
            <input
              type="text"
              name="reason"
              maxLength={500}
              className="mt-1 hui-input w-full max-w-md"
              placeholder="e.g. School holidays"
            />
          </label>
          {skipState.error ? (
            <p className="hui-message-error" role="alert">{skipState.error}</p>
          ) : null}
          {skipState.message ? (
            <p className="hui-message-success" role="status">{skipState.message}</p>
          ) : null}
          <button
            type="submit"
            disabled={skipPending}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring text-sm"
          >
            {skipPending ? "Skipping…" : "Skip this cycle"}
          </button>
        </form>
      </div>
    </div>
  );
}
