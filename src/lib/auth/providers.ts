/** Supabase OAuth provider ids Hui is planned to support. */
export const AUTH_OAUTH_PROVIDER_IDS = [
  "google",
  "apple",
  "facebook",
  "azure",
] as const;

export type AuthOAuthProviderId = (typeof AUTH_OAUTH_PROVIDER_IDS)[number];

export type AuthProviderId = AuthOAuthProviderId | "email";

export type AuthProviderDefinition = {
  id: AuthProviderId;
  /** Auth screen label when enabled (e.g. "Continue with Google"). */
  continueLabel: string;
  /** When false, no UI or server entry points for this provider. */
  enabled: boolean;
  /** Supabase `signInWithOAuth` provider id for OAuth methods. */
  supabaseOAuthProvider?: AuthOAuthProviderId;
};

const OAUTH_PROVIDER_META: Record<
  AuthOAuthProviderId,
  { continueLabel: string; supabaseOAuthProvider: AuthOAuthProviderId }
> = {
  google: {
    continueLabel: "Continue with Google",
    supabaseOAuthProvider: "google",
  },
  apple: {
    continueLabel: "Continue with Apple",
    supabaseOAuthProvider: "apple",
  },
  facebook: {
    continueLabel: "Continue with Facebook",
    supabaseOAuthProvider: "facebook",
  },
  azure: {
    continueLabel: "Continue with Microsoft",
    supabaseOAuthProvider: "azure",
  },
};

/**
 * Authentication method enablement for Hui.
 *
 * OAuth providers remain disabled until developer credentials exist and
 * Supabase Auth provider settings are configured. Do not add placeholder secrets.
 * Enable a provider here only after its OAuth integration is implemented and tested.
 */
export const AUTH_PROVIDERS: readonly AuthProviderDefinition[] = [
  ...AUTH_OAUTH_PROVIDER_IDS.map((id) => ({
    id,
    ...OAUTH_PROVIDER_META[id],
    enabled: false,
  })),
  {
    id: "email",
    continueLabel: "Continue with email",
    enabled: true,
  },
];

export function getAuthProvider(
  id: AuthProviderId,
): AuthProviderDefinition | undefined {
  return AUTH_PROVIDERS.find((provider) => provider.id === id);
}

/** OAuth providers that are enabled for UI and server sign-in. */
export function getEnabledOAuthProviders(): AuthProviderDefinition[] {
  return AUTH_PROVIDERS.filter(
    (provider) => provider.id !== "email" && provider.enabled,
  );
}

export function isEmailAuthEnabled(): boolean {
  return getAuthProvider("email")?.enabled ?? false;
}

export function assertOAuthProviderEnabled(id: AuthOAuthProviderId): void {
  const provider = getAuthProvider(id);
  if (!provider?.enabled) {
    throw new Error(`OAuth provider "${id}" is not enabled.`);
  }
}
