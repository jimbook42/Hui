import {
  assertOAuthProviderEnabled,
  type AuthOAuthProviderId,
} from "./providers";

export type OAuthSignInRequest = {
  provider: AuthOAuthProviderId;
};

/**
 * Gate for future Supabase `signInWithOAuth` calls.
 * Integration tickets should call this before starting an OAuth redirect.
 */
export function validateOAuthSignInRequest(
  provider: AuthOAuthProviderId,
): OAuthSignInRequest {
  assertOAuthProviderEnabled(provider);
  return { provider };
}
