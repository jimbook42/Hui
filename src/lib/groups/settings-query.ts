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
  const map = await listGroupSettingsByGroupIds(supabase, [groupId]);
  return map.get(groupId) ?? null;
}

/** One round-trip for many groups (dashboard / list surfaces). */
export async function listGroupSettingsByGroupIds(
  supabase: SupabaseClient,
  groupIds: string[],
): Promise<Map<string, GroupSettingsRow>> {
  const settings = new Map<string, GroupSettingsRow>();
  if (groupIds.length === 0) {
    return settings;
  }

  const { data, error } = await supabase.from("group_settings").select("*").in("group_id", groupIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const groupId = row.group_id as string;
    settings.set(groupId, mapSettings(row as Record<string, unknown>));
  }

  return settings;
}
