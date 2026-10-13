import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";

import { mapPlanningEventRow } from "./planning-cycle";
import {
  loadRecurrenceCycleModifiers,
  rebuildAndPersistGroupPlanningSnapshot,
} from "./planning-cycle-snapshot";

export async function syncGroupPlanningAfterChange(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const settings = await getGroupSettingsByGroupId(supabase, groupId);
  if (!settings?.recurringEventsEnabled) {
    return;
  }

  const { data: eventRows, error } = await supabase
    .from("events")
    .select("id, status, planning_target_date, starts_at, recurrence_series_id")
    .eq("group_id", groupId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }

  const modifiers = await loadRecurrenceCycleModifiers(supabase, groupId);
  await rebuildAndPersistGroupPlanningSnapshot(
    supabase,
    groupId,
    settings,
    (eventRows ?? []) as Parameters<typeof mapPlanningEventRow>[0][],
    modifiers,
  );
}
