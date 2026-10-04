"use client";

import { useActionState } from "react";
import Link from "next/link";

import { joinGroupViaInviteAction, type JoinActionState } from "@/app/join/actions";

const initialState: JoinActionState = {};

export function JoinInviteButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(joinGroupViaInviteAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p className="hui-message-error" role="alert">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full"
      >
        {pending ? "Joining…" : "Join Hui"}
      </button>
    </form>
  );
}

export function JoinAuthLinks({ token }: { token: string }) {
  const next = encodeURIComponent(`/join/${token}`);
  return (
    <div className="mt-6 flex flex-col gap-3 text-sm">
      <Link
        href={`/sign-in?next=${next}`}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring"
      >
        Sign in to join
      </Link>
      <Link
        href={`/sign-up?next=${next}`}
        className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
      >
        Create account to join
      </Link>
    </div>
  );
}
