import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDisplayName } from "./validation";

export type EnsureProfileResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

/**
 * Ensures a profile row exists for the authenticated user.
 * Idempotent: safe when the auth trigger already created the row.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
  preferredDisplayName?: string,
): Promise<EnsureProfileResult> {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  if (existing) {
    return { ok: true, created: false };
  }

  const fallback =
    normalizeDisplayName(preferredDisplayName ?? "") ?? "Member";

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    display_name: fallback,
  });

  if (!insertError) {
    return { ok: true, created: true };
  }

  if (insertError.code === "23505") {
    return { ok: true, created: false };
  }

  return { ok: false, error: insertError.message };
}
