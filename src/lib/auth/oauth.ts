import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertOAuthProviderEnabled,
  getAuthProvider,
  type AuthOAuthProviderId,
} from "./providers";

export type OAuthSignInRequest = {
  provider: AuthOAuthProviderId;
};

/**
 * Gate for Supabase `signInWithOAuth` calls.
 */
export function validateOAuthSignInRequest(
  provider: AuthOAuthProviderId,
): OAuthSignInRequest {
  assertOAuthProviderEnabled(provider);
  return { provider };
}

export function buildOAuthCallbackUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Maps a provider error query value to the sign-in notice. */
export function oauthCallbackFailureReason(
  error: string,
): "cancelled" | "failed" {
  if (error === "access_denied") {
    return "cancelled";
  }
  return "failed";
}

export async function signInWithOAuthProvider(
  supabase: SupabaseClient,
  provider: AuthOAuthProviderId,
  redirectTo: string,
) {
  const { provider: validatedProvider } = validateOAuthSignInRequest(provider);
  const scopes = getAuthProvider(validatedProvider)?.oauthScopes;
  return supabase.auth.signInWithOAuth({
    provider: validatedProvider,
    options: {
      redirectTo,
      ...(scopes ? { scopes } : {}),
    },
  });
}
