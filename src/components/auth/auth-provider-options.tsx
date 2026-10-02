import {
  getEnabledOAuthProviders,
  type AuthProviderDefinition,
} from "@/lib/auth/providers";

/**
 * Renders enabled third-party sign-in controls above the email form.
 * Returns nothing while every OAuth provider is disabled (current production default).
 */
export function AuthOAuthSection() {
  const providers = getEnabledOAuthProviders();
  if (providers.length === 0) {
    return null;
  }

  return (
    <>
      <ul className="space-y-3">
        {providers.map((provider) => (
          <li key={provider.id}>
            <OAuthProviderControl provider={provider} />
          </li>
        ))}
      </ul>
      <AuthMethodDivider />
    </>
  );
}

/** OAuth integration tickets attach `signInWithOAuth` here per enabled provider. */
function OAuthProviderControl({
  provider,
}: {
  provider: AuthProviderDefinition;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800/50"
    >
      {provider.continueLabel}
    </button>
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
