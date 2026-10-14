"use client";

import { useActionState } from "react";

import { createGroupAction, type GroupActionState } from "@/app/groups/actions";
import { AuthField } from "@/components/auth/auth-form";
import { PendingButton } from "@/components/ui/pending-button";
import { HUI_ONE_LINE_EXPLAINER } from "@/domain/events/hui-explainer";

const initialState: GroupActionState = {};

export function CreateGroupFlow() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <section className="space-y-4">
      <h2 className="hui-type-page-title text-foreground">Name your group</h2>
      <p className="text-sm font-semibold text-muted-foreground">{HUI_ONE_LINE_EXPLAINER}</p>
      <form action={formAction} className="space-y-4">
        <AuthField label="Group name" name="name" autoComplete="organization" required />
        {state.error ? (
          <p className="hui-message-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <PendingButton type="submit" pendingLabel="Creating…" size="touch" disabled={pending}>
          {pending ? "Creating…" : "Create group"}
        </PendingButton>
      </form>
    </section>
  );
}
