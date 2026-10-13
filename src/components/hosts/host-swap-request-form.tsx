"use client";

import { useActionState, useState } from "react";

import {
  requestHostSwapAction,
  type HostActionState,
} from "@/app/hosts/actions";
import { beginInteraction, markInteraction } from "@/lib/perf/client-interaction-perf";
import {
  hostSwapPrimaryActionLabel,
  shouldIncludeNoReplacementAck,
  type HostSwapNoReplacementStep,
} from "@/domain/hosts/host-swap-form";

const NO_REPLACEMENT_WARNING =
  "No one else is available to host. If you continue, this hui will have no host.";

type HostSwapRequestFormProps = {
  eventId: string;
  hasReplacement: boolean;
};

const initialState: HostActionState = {};

export function HostSwapRequestForm({ eventId, hasReplacement }: HostSwapRequestFormProps) {
  const [state, formAction, pending] = useActionState(requestHostSwapAction, initialState);
  const [noReplacementStep, setNoReplacementStep] = useState<HostSwapNoReplacementStep>("idle");

  const includeAck = shouldIncludeNoReplacementAck(hasReplacement, noReplacementStep);
  const primaryLabel = hostSwapPrimaryActionLabel(hasReplacement, noReplacementStep, pending);

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        beginInteraction("form_save");
        markInteraction("form_save", "handler-start");
        markInteraction("form_save", "optimistic-ui-visible");

        if (!hasReplacement && noReplacementStep === "idle") {
          event.preventDefault();
          setNoReplacementStep("confirm");
        }
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      {includeAck ? <input type="hidden" name="acknowledge_no_replacement" value="1" /> : null}
      {!hasReplacement ? (
        <p className="text-sm text-muted-foreground">{NO_REPLACEMENT_WARNING}</p>
      ) : null}
      {state.error ? (
        <p className="hui-message-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
        >
          {primaryLabel}
        </button>
        {!hasReplacement && noReplacementStep === "confirm" ? (
          <button
            type="button"
            disabled={pending}
            className="hui-btn hui-btn-ghost rounded-full hui-focus-ring"
            onClick={() => setNoReplacementStep("idle")}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
