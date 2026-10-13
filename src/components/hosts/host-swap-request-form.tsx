"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
  const formRef = useRef<HTMLFormElement>(null);
  const [acknowledgedNoReplacement, setAcknowledgedNoReplacement] = useState(false);
  const submitAfterAckRef = useRef(false);

  useEffect(() => {
    if (!submitAfterAckRef.current || !acknowledgedNoReplacement || pending) {
      return;
    }
    submitAfterAckRef.current = false;
    formRef.current?.requestSubmit();
  }, [acknowledgedNoReplacement, pending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        beginInteraction("form_save");
        markInteraction("form_save", "handler-start");
        markInteraction("form_save", "optimistic-ui-visible");

        if (!hasReplacement && !acknowledgedNoReplacement) {
          event.preventDefault();
          if (window.confirm(NO_REPLACEMENT_WARNING)) {
            submitAfterAckRef.current = true;
            setAcknowledgedNoReplacement(true);
          }
        }
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      {acknowledgedNoReplacement ? (
        <input type="hidden" name="acknowledge_no_replacement" value="1" />
      ) : null}
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
