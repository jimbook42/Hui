import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupResponseSettings = {
  maybeResponsesEnabled: boolean;
};

/** Lightweight settings for availability actions (avoids full group detail). */
export async function getGroupResponseSettings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupResponseSettings | null> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("maybe_responses_enabled")
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return {
    maybeResponsesEnabled: Boolean(data.maybe_responses_enabled),
  };
}
