import {
  getEnabledOAuthProviders,
} from "@/lib/auth/providers";

import { AuthOAuthButtons } from "./auth-oauth-buttons";

type AuthOAuthSectionProps = {
  /** Post-auth redirect for OAuth (sign-in deep links). */
  next?: string;
};

/**
 * Renders enabled third-party sign-in controls above the email form.
 */
export function AuthOAuthSection({ next }: AuthOAuthSectionProps = {}) {
  const providers = getEnabledOAuthProviders();
  if (providers.length === 0) {
    return null;
  }

  return <AuthOAuthButtons providers={providers} next={next} />;
}
