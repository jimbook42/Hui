"use client";

import { useActionState } from "react";

import { oauthSignInAction, type AuthActionState } from "@/app/auth/actions";
import type { AuthProviderDefinition } from "@/lib/auth/providers";

const initialState: AuthActionState = {};

type AuthOAuthButtonsProps = {
  providers: AuthProviderDefinition[];
  next?: string;
};

export function AuthOAuthButtons({ providers, next }: AuthOAuthButtonsProps) {
  const [state, formAction, pending] = useActionState(
    oauthSignInAction,
    initialState,
  );

  return (
    <>
      <ul className="space-y-3">
        {providers.map((provider) => (
          <li key={provider.id}>
            <form action={formAction}>
              <input type="hidden" name="provider" value={provider.id} />
              {next ? (
                <input type="hidden" name="next" value={next} />
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {provider.continueLabel}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {state.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <AuthMethodDivider />
    </>
  );
}

function AuthMethodDivider() {
  return (
    <div className="relative my-6">
      <div
        className="absolute inset-0 flex items-center"
        aria-hidden="true"
      >
        <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">
          or
        </span>
      </div>
    </div>
  );
}
