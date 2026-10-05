"use client";

import { useActionState } from "react";

import { createGroupAction, type GroupActionState } from "@/app/groups/actions";
import { AuthField } from "@/components/auth/auth-form";
import { PendingButton } from "@/components/ui/pending-button";

const initialState: GroupActionState = {};

export function CreateGroupFlow() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <section className="space-y-4">
      <h2 className="hui-type-page-title text-foreground">Name your group</h2>
      <p className="text-sm font-semibold text-muted-foreground">
        Next you&apos;ll plan your first gathering — who to invite comes after that has context.
      </p>
      <form action={formAction} className="space-y-4">
        <AuthField label="Group name" name="name" autoComplete="organization" required />
        {state.error ? (
          <p className="hui-message-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <PendingButton type="submit" pendingLabel="Creating…" size="touch" disabled={pending}>
          {pending ? "Creating…" : "Plan your first gathering"}
        </PendingButton>
      </form>
    </section>
  );
}
