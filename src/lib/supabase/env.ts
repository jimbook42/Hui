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

export function getPublicSupabaseConfig(env?: EnvSource): PublicSupabaseConfig {
  // Use literal `process.env.NEXT_PUBLIC_*` when no override is passed so Next.js can
  // inline public env at build time in client bundles (dynamic `env[key]` is not replaced).
  const url = (env ? env[PUBLIC_ENV_NAMES.url] : process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const publishableKey = (
    env ? env[PUBLIC_ENV_NAMES.publishableKey] : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

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

export function hasPublicSupabaseConfig(env?: EnvSource): boolean {
  const url = (env ? env[PUBLIC_ENV_NAMES.url] : process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const publishableKey = (
    env ? env[PUBLIC_ENV_NAMES.publishableKey] : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  return Boolean(url && publishableKey);
}
