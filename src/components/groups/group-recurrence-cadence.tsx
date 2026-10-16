"use client";

import { useActionState } from "react";

import {
  updateGroupRecurrenceCadenceAction,
  type PlanningCycleActionState,
} from "@/app/groups/planning-cycle-actions";
import { formatCadenceLabel } from "@/domain/recurrence/planning-cycle";
import type { NominalPreviewRow } from "@/domain/recurrence/nominal-preview";
import { formatNominalPlanningDate } from "@/lib/groups/planning-cycle";
import type { GroupPlanningContext } from "@/lib/groups/planning-cycle-queries";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: PlanningCycleActionState = {};

function previewLabel(row: NominalPreviewRow): string {
  switch (row.disposition) {
    case "next_open":
      return "Next to plan";
    case "upcoming_open":
      return "Upcoming";
    case "skipped":
      return "Skipped";
    case "planning":
      return "Planning";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    default:
      return "";
  }
}

export function GroupRecurrenceCadenceSection({
  context,
}: {
  context: GroupPlanningContext;
}) {
  const [state, formAction, pending] = useActionState(
    updateGroupRecurrenceCadenceAction,
    initialState,
  );
  useActionStateRefresh(state);

  const cadence = context.cycle.cadence;
  if (!cadence) {
    return null;
  }

  return (
    <div className="mt-6 space-y-6 border-t border-border/60 pt-6">
      <div>
        <p className="hui-type-label text-muted-foreground">Upcoming planned dates</p>
        {context.recurrencePaused ? (
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Recurrence is paused — dates below are informational until an admin resumes.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm font-semibold text-foreground">
          {context.upcomingNominals.map((row) => (
            <li
              key={row.nominalDate}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span>{formatNominalPlanningDate(row.nominalDate)}</span>
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {previewLabel(row)}
                {row.disposition === "skipped" && row.skipReason
                  ? ` — ${row.skipReason}`
                  : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {context.canManageRecurrence ? (
        <div>
          <p className="hui-type-label text-muted-foreground">How often</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            How often you plan to meet. Changes apply to future gatherings.
          </p>
          <form action={formAction} className="mt-4 space-y-3">
            <input type="hidden" name="group_id" value={context.groupId} />
            <div className="flex flex-wrap gap-3">
              <label className="block text-sm font-semibold text-foreground">
                Every
                <input
                  type="number"
                  name="interval_count"
                  min={1}
                  max={52}
                  defaultValue={cadence.intervalCount}
                  required
                  className="mt-1 hui-input w-20"
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Unit
                <select
                  name="interval_unit"
                  defaultValue={cadence.intervalUnit}
                  className="mt-1 hui-input"
                >
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Starts from
                <input
                  type="date"
                  name="anchor_date"
                  defaultValue={cadence.anchorDate}
                  required
                  className="mt-1 hui-input"
                />
              </label>
            </div>
            {state.error ? (
              <p className="hui-message-error" role="alert">{state.error}</p>
            ) : null}
            {state.message ? (
              <p className="hui-message-success" role="status">{state.message}</p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="hui-btn hui-btn-secondary rounded-full hui-focus-ring text-sm"
            >
              {pending ? "Saving…" : "Save schedule"}
            </button>
          </form>
        </div>
      ) : (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="hui-type-label text-muted-foreground">How often</dt>
            <dd className="mt-1 font-extrabold text-foreground">
              {formatCadenceLabel(cadence)}
            </dd>
          </div>
          <div>
            <dt className="hui-type-label text-muted-foreground">Starts from</dt>
            <dd className="mt-1 font-extrabold text-foreground">
              {formatNominalPlanningDate(cadence.anchorDate)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
