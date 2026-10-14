"use client";

import { useActionState } from "react";

import { oauthSignInAction, type AuthActionState } from "@/app/auth/actions";
import type { AuthOAuthProviderId, AuthProviderDefinition } from "@/lib/auth/providers";

import { AuthOAuthProviderIcon } from "./auth-oauth-provider-icon";
import { AuthSlowActionNotice } from "./auth-slow-action-notice";

const PRIMARY_ORDER: AuthOAuthProviderId[] = ["google", "facebook", "azure"];

const initialState: AuthActionState = {};

type AuthPrimaryOAuthProps = {
  providers: AuthProviderDefinition[];
  next?: string;
};

export function AuthPrimaryOAuth({ providers, next }: AuthPrimaryOAuthProps) {
  const ordered = PRIMARY_ORDER
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is AuthProviderDefinition => Boolean(p));

  const [state, formAction, pending] = useActionState(oauthSignInAction, initialState);

  return (
    <>
      <ul className="space-y-3">
        {ordered.map((provider) => (
          <li key={provider.id}>
            <form action={formAction}>
              <input type="hidden" name="provider" value={provider.id} />
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <button
                type="submit"
                disabled={pending}
                className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full"
              >
                <AuthOAuthProviderIcon providerId={provider.id as AuthOAuthProviderId} />
                {provider.continueLabel}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <AuthSlowActionNotice pending={pending} />
      {state.error ? (
        <p className="hui-message-error mt-3" role="alert">
          {state.error}
        </p>
      ) : null}
    </>
  );
}
