"use client";

import { useState } from "react";

import {
  dismissDisplayNamePromptAction,
  saveDisplayNameFromPromptAction,
} from "@/app/profile/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { PendingButton } from "@/components/ui/pending-button";
import { normalizeDisplayName } from "@/lib/profiles/validation";

type DisplayNamePromptFlowProps = {
  defaultDisplayName: string;
};

export function DisplayNamePromptFlow({ defaultDisplayName }: DisplayNamePromptFlowProps) {
  const [displayName, setDisplayName] = useState(defaultDisplayName);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="hui-type-page-title text-foreground">What should your group call you?</h2>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          This is how you appear in member lists, answers, and notifications for new hui.
        </p>
      </div>
      <AuthForm action={saveDisplayNameFromPromptAction} submitLabel="Save name">
        <label className="hui-label">
          <span>Display name</span>
          <input
            className="hui-input"
            name="display_name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
      </AuthForm>
      <form action={dismissDisplayNamePromptAction}>
        <PendingButton type="submit" variant="secondary" size="touch">
          Keep &quot;{normalizeDisplayName(defaultDisplayName) ?? defaultDisplayName}&quot;
        </PendingButton>
      </form>
    </div>
  );
}
