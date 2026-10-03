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
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
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
        className="inline-flex justify-center rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Sign in to join
      </Link>
      <Link
        href={`/sign-up?next=${next}`}
        className="inline-flex justify-center rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100"
      >
        Create account to join
      </Link>
    </div>
  );
}
