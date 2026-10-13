import type { SupabaseClient } from "@supabase/supabase-js";

import { mapGroupSettingsRow } from "./map-settings";
import type { GroupSettingsRow } from "./types";

function mapSettings(row: Record<string, unknown>): GroupSettingsRow {
  return mapGroupSettingsRow(row);
}

/** Group settings only — avoids loading the full member roster (used on respond flow). */
export async function getGroupSettingsByGroupId(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupSettingsRow | null> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return mapSettings(data);
}
