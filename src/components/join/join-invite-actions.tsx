"use client";

import { useActionState } from "react";
import Link from "next/link";

import { joinGroupViaInviteAction, type JoinActionState } from "@/app/join/actions";
import { authPathWithNext } from "@/lib/auth/routes";

const initialState: JoinActionState = {};

export function JoinInviteButton({
  token,
  groupName,
  hasActivePlanning,
  focusEventId,
}: {
  token: string;
  groupName: string;
  hasActivePlanning: boolean;
  focusEventId?: string | null;
}) {
  const [state, formAction, pending] = useActionState(joinGroupViaInviteAction, initialState);
  const label = hasActivePlanning
    ? "Join and answer"
    : groupName.trim()
      ? `Join ${groupName.trim()}`
      : "Join group";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {focusEventId ? <input type="hidden" name="focus_event_id" value={focusEventId} /> : null}
      {state.error ? (
        <p className="hui-message-error" role="alert">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full"
      >
        {pending ? "Joining…" : label}
      </button>
    </form>
  );
}

export function JoinAuthLinks({
  token,
  focusEventId,
  groupName,
}: {
  token: string;
  focusEventId?: string | null;
  groupName: string;
}) {
  const joinPath =
    focusEventId ? `/join/${token}?event=${encodeURIComponent(focusEventId)}` : `/join/${token}`;
  const trimmedGroup = groupName.trim();
  const signInLabel = trimmedGroup
    ? `Sign in to join ${trimmedGroup}`
    : "Sign in to join";
  const signUpLabel = trimmedGroup
    ? `Create account to join ${trimmedGroup}`
    : "Create account to join";
  return (
    <div className="mt-6 flex flex-col gap-3 text-sm">
      <Link
        href={authPathWithNext("/sign-up", joinPath)}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring"
      >
        {signUpLabel}
      </Link>
      <Link
        href={authPathWithNext("/sign-in", joinPath)}
        className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
      >
        {signInLabel}
      </Link>
    </div>
  );
}
