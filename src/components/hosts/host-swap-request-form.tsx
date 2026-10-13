"use client";

import { useActionState } from "react";

import {
  requestHostSwapAction,
  type HostActionState,
} from "@/app/hosts/actions";
import { beginInteraction, markInteraction } from "@/lib/perf/client-interaction-perf";

const NO_REPLACEMENT_WARNING =
  "No one else is available to host. If you continue, this hui will have no host.";

type HostSwapRequestFormProps = {
  eventId: string;
  hasReplacement: boolean;
};

const initialState: HostActionState = {};

export function HostSwapRequestForm({ eventId, hasReplacement }: HostSwapRequestFormProps) {
  const [state, formAction, pending] = useActionState(requestHostSwapAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        beginInteraction("form_save");
        markInteraction("form_save", "handler-start");
        markInteraction("form_save", "optimistic-ui-visible");

        const form = event.currentTarget;
        const acknowledged =
          (new FormData(form).get("acknowledge_no_replacement") ?? "") === "1";
        if (!hasReplacement && !acknowledged) {
          event.preventDefault();
          if (window.confirm(NO_REPLACEMENT_WARNING)) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "acknowledge_no_replacement";
            input.value = "1";
            form.appendChild(input);
            form.requestSubmit();
          }
        }
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      {!hasReplacement ? (
        <p className="text-sm text-muted-foreground">{NO_REPLACEMENT_WARNING}</p>
      ) : null}
      {state.error ? (
        <p className="hui-message-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
      >
        {pending ? "Please wait…" : "Ask to swap"}
      </button>
    </form>
  );
}
