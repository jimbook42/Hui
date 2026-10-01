import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDisplayName } from "./validation";

export type UpdateDisplayNameResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateOwnDisplayName(
  supabase: SupabaseClient,
  userId: string,
  rawDisplayName: string,
): Promise<UpdateDisplayNameResult> {
  const displayName = normalizeDisplayName(rawDisplayName);
  if (!displayName) {
    return {
      ok: false,
      error: `Display name must be between 1 and 80 characters.`,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data?.length) {
    return { ok: false, error: "Profile not found." };
  }

  return { ok: true };
}
