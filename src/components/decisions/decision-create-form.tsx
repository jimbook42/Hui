"use client";

import { useActionState } from "react";

import {
  createEventDecisionAction,
  updateEventDecisionDraftAction,
  type DecisionActionState,
} from "@/app/decisions/actions";
import type { DecisionPollView } from "@/domain/decisions/display";

const initialState: DecisionActionState = {};

type DecisionCreateFormProps = {
  eventId: string;
  editPoll?: DecisionPollView | null;
};

export function DecisionCreateForm({ eventId, editPoll }: DecisionCreateFormProps) {
  const action = editPoll ? updateEventDecisionDraftAction : createEventDecisionAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const defaultOptions = editPoll
    ? editPoll.options.map((option) => option.label).join("\n")
    : "";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      {editPoll ? <input type="hidden" name="decision_id" value={editPoll.id} /> : null}
      <div>
        <label className="hui-type-label text-muted-foreground" htmlFor="decision-question">
          Question
        </label>
        <input
          id="decision-question"
          name="question"
          required
          maxLength={200}
          defaultValue={editPoll?.question ?? ""}
          placeholder="Where should we eat?"
          className="hui-input mt-2 w-full"
        />
      </div>
      <div>
        <label className="hui-type-label text-muted-foreground" htmlFor="decision-options">
          Options
        </label>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          One per line. At least two options.
        </p>
        <textarea
          id="decision-options"
          name="options"
          required
          rows={4}
          defaultValue={defaultOptions}
          placeholder={"Riverside Kitchen\nThai Orchid\nHome"}
          className="hui-input mt-2 min-h-[6rem] w-full resize-y"
        />
      </div>
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
      <button type="submit" disabled={pending} className="hui-btn hui-btn-primary rounded-full hui-focus-ring">
        {pending ? "Saving…" : editPoll ? "Update decision" : "Open decision"}
      </button>
    </form>
  );
}
