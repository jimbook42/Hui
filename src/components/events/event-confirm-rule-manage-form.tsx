"use client";

import { useActionState, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { updateEventConfirmRuleAction } from "@/app/events/scheduling-actions";
import { EventConfirmRuleField } from "@/components/events/event-confirm-rule-field";
import { PendingButton } from "@/components/ui/pending-button";
import type { EventConfirmRule } from "@/domain/events/confirm-rule";
import { eventConfirmRuleDisplayLine } from "@/domain/events/confirm-rule";

type EventConfirmRuleManageFormProps = {
  eventId: string;
  confirmRule: EventConfirmRule;
  canEdit: boolean;
};

const initialState: EventActionState = {};

export function EventConfirmRuleManageForm({
  eventId,
  confirmRule,
  canEdit,
}: EventConfirmRuleManageFormProps) {
  const [state, formAction, pending] = useActionState(
    updateEventConfirmRuleAction,
    initialState,
  );
  const [rule, setRule] = useState(confirmRule);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground">
        {eventConfirmRuleDisplayLine(confirmRule)}
      </p>
      {canEdit ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="confirm_rule" value={rule} />
          <EventConfirmRuleField value={rule} onChange={setRule} />
          {state.error ? (
            <p className="hui-message-error" role="alert">{state.error}</p>
          ) : null}
          {state.message ? (
            <p className="hui-message-success" role="status">{state.message}</p>
          ) : null}
          <PendingButton type="submit" pendingLabel="Saving…" size="sm" disabled={pending}>
            Save confirmation rule
          </PendingButton>
        </form>
      ) : null}
    </div>
  );
}
