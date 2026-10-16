"use client";

import { useActionState, useCallback, useMemo, useState } from "react";

import {
  createEventDecisionAction,
  updateEventDecisionDraftAction,
  type DecisionActionState,
} from "@/app/decisions/actions";
import type { DecisionPollView } from "@/domain/decisions/display";
import { validateDecisionOptionInputs } from "@/domain/decisions/validation";

const initialState: DecisionActionState = {};
const MAX_OPTIONS = 12;
const MIN_ROWS = 2;

type DecisionCreateFormProps = {
  eventId: string;
  editPoll?: DecisionPollView | null;
};

function initialOptionRows(editPoll?: DecisionPollView | null): string[] {
  if (editPoll && editPoll.options.length > 0) {
    const labels = editPoll.options.map((option) => option.label);
    return labels.length >= MIN_ROWS ? labels : [...labels, "", ""].slice(0, MIN_ROWS);
  }
  return ["", ""];
}

export function DecisionCreateForm({ eventId, editPoll }: DecisionCreateFormProps) {
  const action = editPoll ? updateEventDecisionDraftAction : createEventDecisionAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [options, setOptions] = useState<string[]>(() => initialOptionRows(editPoll));
  const [clientError, setClientError] = useState<string | null>(null);

  const canAdd = options.length < MAX_OPTIONS;
  const canRemove = options.length > MIN_ROWS;

  const addOption = useCallback(() => {
    if (!canAdd) {
      return;
    }
    setOptions((rows) => [...rows, ""]);
  }, [canAdd]);

  const removeOption = useCallback(
    (index: number) => {
      if (!canRemove) {
        return;
      }
      setOptions((rows) => rows.filter((_, i) => i !== index));
    },
    [canRemove],
  );

  const updateOption = useCallback((index: number, value: string) => {
    setOptions((rows) => rows.map((row, i) => (i === index ? value : row)));
  }, []);

  const optionFieldError = useMemo(() => validateDecisionOptionInputs(options), [options]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const validationError = validateDecisionOptionInputs(options);
    if (validationError) {
      event.preventDefault();
      setClientError(validationError);
      return;
    }
    setClientError(null);
  }

  function handleOptionKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (options.length >= MAX_OPTIONS) {
      return;
    }
    const focusIndex = index + 1;
    setOptions((rows) => {
      const next = [...rows];
      next.splice(focusIndex, 0, "");
      return next;
    });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`input[data-decision-option="${focusIndex}"]`)?.focus();
    });
  }

  const displayError = clientError ?? state.error;

  return (
    <form action={formAction} className="space-y-4" onSubmit={handleSubmit}>
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
        <p className="hui-type-label text-muted-foreground">Options</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          At least two options. Press Enter in a row to add another.
        </p>
        <ul className="mt-2 space-y-2">
          {options.map((value, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                data-decision-option={index}
                name="option"
                value={value}
                onChange={(event) => updateOption(index, event.target.value)}
                onKeyDown={(event) => handleOptionKeyDown(index, event)}
                placeholder={`Option ${index + 1}`}
                maxLength={120}
                className="hui-input min-w-0 flex-1"
                aria-label={`Option ${index + 1}`}
              />
              {canRemove ? (
                <button
                  type="button"
                  className="hui-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-muted-foreground hover:bg-muted"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() => removeOption(index)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canAdd ? (
          <button
            type="button"
            className="hui-link mt-3 text-sm font-extrabold"
            onClick={addOption}
          >
            + Add option
          </button>
        ) : null}
        {optionFieldError ? (
          <p className="hui-message-error mt-2" role="alert">
            {optionFieldError}
          </p>
        ) : null}
      </div>
      {displayError ? (
        <p className="hui-message-error" role="alert">
          {displayError}
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
