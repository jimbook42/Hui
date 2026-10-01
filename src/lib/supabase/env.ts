export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

const PUBLIC_ENV_NAMES = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

/**
 * Reads Supabase settings safe for browser bundling (URL + publishable key).
 * Throws a clear error in development when configuration is missing.
 */
type EnvSource = Record<string, string | undefined>;

export function getPublicSupabaseConfig(
  env: EnvSource = process.env,
): PublicSupabaseConfig {
  const url = env[PUBLIC_ENV_NAMES.url]?.trim();
  const publishableKey = env[PUBLIC_ENV_NAMES.publishableKey]?.trim();

  if (!url || !publishableKey) {
    const missing: string[] = [];
    if (!url) {
      missing.push(PUBLIC_ENV_NAMES.url);
    }
    if (!publishableKey) {
      missing.push(PUBLIC_ENV_NAMES.publishableKey);
    }

    throw new Error(
      `Missing Supabase configuration: ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and add values from your Supabase project Connect panel.",
    );
  }

  return { url, publishableKey };
}

export function hasPublicSupabaseConfig(env: EnvSource = process.env): boolean {
  return Boolean(
    env[PUBLIC_ENV_NAMES.url]?.trim() &&
      env[PUBLIC_ENV_NAMES.publishableKey]?.trim(),
  );
}
