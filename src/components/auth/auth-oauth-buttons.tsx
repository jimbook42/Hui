"use client";

import { useActionState } from "react";

import { oauthSignInAction, type AuthActionState } from "@/app/auth/actions";
import type { AuthOAuthProviderId, AuthProviderDefinition } from "@/lib/auth/providers";

import { AuthOAuthProviderIcon } from "./auth-oauth-provider-icon";

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
                className="hui-btn hui-btn-secondary rounded-full hui-focus-ring w-full"
              >
                {provider.id !== "email" ? (
                  <AuthOAuthProviderIcon
                    providerId={provider.id as AuthOAuthProviderId}
                  />
                ) : null}
                {provider.continueLabel}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {state.error ? (
        <p className="hui-message-error mt-3" role="alert">
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
        <div className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-surface px-2 text-muted-foreground">
          or
        </span>
      </div>
    </div>
  );
}
