/** Supabase OAuth provider ids Hui is planned to support. */
export const AUTH_OAUTH_PROVIDER_IDS = [
  "google",
  "azure",
  "facebook",
  "apple",
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
  /**
   * Extra scopes for `signInWithOAuth`. Supabase Auth always requests `openid`
   * for Azure and appends these. Azure must include `email` or Auth rejects the
   * callback with no email address.
   */
  oauthScopes?: string;
};

const OAUTH_PROVIDER_META: Record<
  AuthOAuthProviderId,
  {
    continueLabel: string;
    supabaseOAuthProvider: AuthOAuthProviderId;
    oauthScopes?: string;
  }
> = {
  google: {
    continueLabel: "Sign in with Google",
    supabaseOAuthProvider: "google",
  },
  apple: {
    continueLabel: "Continue with Apple",
    supabaseOAuthProvider: "apple",
  },
  facebook: {
    continueLabel: "Sign in with Facebook",
    supabaseOAuthProvider: "facebook",
  },
  azure: {
    continueLabel: "Sign in with Microsoft",
    supabaseOAuthProvider: "azure",
    oauthScopes: "email",
  },
};

/** OAuth providers always enabled when integrated (Supabase dashboard must match). */
const CORE_ENABLED_OAUTH_PROVIDER_IDS: ReadonlySet<AuthOAuthProviderId> =
  new Set(["google", "azure"]);

/**
 * Facebook OAuth is gated by `NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true"` (exact string).
 * Public env must be referenced statically so Next.js can inline it into the client bundle.
 */
export function isFacebookLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true";
}

/** OAuth providers enabled in Hui UI and server actions for the current environment. */
export function getEnabledOAuthProviderIds(): ReadonlySet<AuthOAuthProviderId> {
  const ids = new Set(CORE_ENABLED_OAUTH_PROVIDER_IDS);
  if (isFacebookLoginEnabled()) {
    ids.add("facebook");
  }
  return ids;
}

/**
 * Authentication method enablement for Hui.
 *
 * OAuth providers stay disabled until the Hui-side integration is complete and
 * Supabase Auth provider settings are configured. Do not add placeholder secrets.
 */
export function getAuthProviders(): readonly AuthProviderDefinition[] {
  const enabledOAuthIds = getEnabledOAuthProviderIds();
  return [
    ...AUTH_OAUTH_PROVIDER_IDS.map((id) => ({
      id,
      ...OAUTH_PROVIDER_META[id],
      enabled: enabledOAuthIds.has(id),
    })),
    {
      id: "email",
      continueLabel: "Continue with email",
      enabled: true,
    },
  ];
}

export function getAuthProvider(
  id: AuthProviderId,
): AuthProviderDefinition | undefined {
  return getAuthProviders().find((provider) => provider.id === id);
}

/** OAuth providers that are enabled for UI and server sign-in. */
export function getEnabledOAuthProviders(): AuthProviderDefinition[] {
  return getAuthProviders().filter(
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

export function isAuthOAuthProviderId(
  value: string,
): value is AuthOAuthProviderId {
  return (AUTH_OAUTH_PROVIDER_IDS as readonly string[]).includes(value);
}
