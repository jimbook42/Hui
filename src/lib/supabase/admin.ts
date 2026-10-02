import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Server-only Supabase client with the secret key. Used for Auth Admin APIs
 * (e.g. deleting auth.users). Never import from client components.
 */
export function createSecretSupabaseClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY. Add it to the server environment for account deletion.",
    );
  }

  const { url } = getPublicSupabaseConfig();
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
