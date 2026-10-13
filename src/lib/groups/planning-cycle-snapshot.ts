import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GroupPlanningCycle } from "@/lib/groups/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

import {
  buildGroupPlanningCycle,
  mapPlanningEventRow,
  type BuildGroupPlanningCycleOptions,
} from "./planning-cycle";

export async function loadRecurrenceCycleModifiers(
  supabase: SupabaseClient,
  groupId: string,
): Promise<BuildGroupPlanningCycleOptions> {
  const [prefsResult, skipsResult] = await Promise.all([
    supabase
      .from("group_recurrence_preferences")
      .select("recurrence_paused_at")
      .eq("group_id", groupId)
      .maybeSingle(),
    supabase
      .from("group_planning_cycle_skips")
      .select("nominal_date")
      .eq("group_id", groupId),
  ]);

  if (prefsResult.error) {
    throw new Error(prefsResult.error.message);
  }
  if (skipsResult.error) {
    throw new Error(skipsResult.error.message);
  }

  return {
    recurrencePaused: Boolean(prefsResult.data?.recurrence_paused_at),
    skippedNominalDates: (skipsResult.data ?? []).map((row) => row.nominal_date as string),
  };
}

export async function persistGroupPlanningSnapshot(
  supabase: SupabaseClient,
  groupId: string,
  cycle: GroupPlanningCycle,
): Promise<void> {
  const { error } = await supabase.rpc("upsert_group_planning_snapshot", {
    p_group_id: groupId,
    p_next_nominal_date: cycle.nextTargetDate,
    p_planning_opens_on: cycle.planningOpensOn,
    p_phase: cycle.phase,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function rebuildAndPersistGroupPlanningSnapshot(
  supabase: SupabaseClient,
  groupId: string,
  settings: GroupSettingsRow,
  eventRows: Parameters<typeof mapPlanningEventRow>[0][] | null,
  modifiers: BuildGroupPlanningCycleOptions,
): Promise<GroupPlanningCycle> {
  const events = (eventRows ?? []).map((row) => mapPlanningEventRow(row));
  const cycle = buildGroupPlanningCycle(settings, events, modifiers);
  await persistGroupPlanningSnapshot(supabase, groupId, cycle);
  return cycle;
}
