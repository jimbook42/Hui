"use client";

import { useActionState, useState } from "react";

import { rescheduleProposalNominalAction } from "@/app/events/stale-proposal-actions";
import type { EventActionState } from "@/app/events/actions";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { WallClockDateField } from "@/components/events/wall-clock-picker-field";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { PendingButton } from "@/components/ui/pending-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { eventManagePath } from "@/lib/events/paths";
import { formatStaleProposalAutoCancelClause } from "@/domain/events/stale-proposal";
import { formatNominalPlanningDate } from "@/lib/groups/planning-cycle";
import { useActionStateRefresh } from "@/lib/ui/use-action-state-refresh";

const initialState: EventActionState = {};

type StaleProposalBannerProps = {
  eventId: string;
  nominalDate: string;
  canManage: boolean;
  minDate: string;
  suggestedDate: string;
};

export function StaleProposalBanner({
  eventId,
  nominalDate,
  canManage,
  minDate,
  suggestedDate,
}: StaleProposalBannerProps) {
  const autoCancelClause = formatStaleProposalAutoCancelClause(nominalDate, minDate);
  const [nextDate, setNextDate] = useState(suggestedDate);
  const [ackStaleCandidates, setAckStaleCandidates] = useState(false);
  const [state, formAction, pending] = useActionState(rescheduleProposalNominalAction, initialState);
  useActionStateRefresh(state);

  const needsCandidateAck =
    state.error?.includes("Some proposed times are before the new planning date") ?? false;

  if (!canManage) {
    return (
      <HuiSurface tone="clay" shape="soft" padding="md" className="hui-rise-2" role="status">
        <p className="text-lg font-extrabold text-foreground">This proposal&apos;s date has passed</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          The organiser needs to pick a new date or cancel this hui.
        </p>
      </HuiSurface>
    );
  }

  return (
    <HuiSurface tone="clay" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-lg font-extrabold text-foreground">This proposal&apos;s date has passed</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        It was planned around {formatNominalPlanningDate(nominalDate)}. Pick a new planning date or
        cancel — {autoCancelClause}
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="nominal_date" value={nextDate} />
        {ackStaleCandidates || needsCandidateAck ? (
          <input type="hidden" name="ack_stale_candidates" value="1" />
        ) : null}
        <WallClockDateField
          label="New planning date"
          value={nextDate}
          min={minDate}
          onChange={setNextDate}
        />
        {state.error ? (
          <p className="hui-message-error" role="alert">{state.error}</p>
        ) : null}
        {needsCandidateAck ? (
          <label className="flex items-start gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={ackStaleCandidates}
              onChange={(event) => setAckStaleCandidates(event.target.checked)}
              className="mt-1"
            />
            <span>Update the planning date anyway (some proposed times stay on earlier days)</span>
          </label>
        ) : null}
        {state.message ? (
          <p className="hui-message-note" role="status">{state.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <PendingButton type="submit" variant="secondary" size="touch" disabled={pending}>
            Update date
          </PendingButton>
          <HuiLinkButton href={eventManagePath(eventId)} variant="soft" size="touch">
            Add new times
          </HuiLinkButton>
        </div>
      </form>
      <CancelEventButton eventId={eventId} />
    </HuiSurface>
  );
}
