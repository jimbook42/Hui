import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GroupPlanningCycle } from "@/lib/groups/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

import {
  buildGroupPlanningCycle,
  mapPlanningEventRow,
  type BuildGroupPlanningCycleOptions,
} from "./planning-cycle";

export type PlanningCycleSkipRecord = {
  nominalDate: string;
  reason: string | null;
};

export type RecurrenceCycleModifiers = BuildGroupPlanningCycleOptions & {
  recentSkips: PlanningCycleSkipRecord[];
};

function mapRecurrenceCycleModifiers(
  prefsRow: { recurrence_paused_at?: string | null } | null | undefined,
  skipRows: Array<{ nominal_date: string; reason: string | null }>,
): RecurrenceCycleModifiers {
  const recentSkips = skipRows.map((row) => ({
    nominalDate: row.nominal_date,
    reason: row.reason ?? null,
  }));

  return {
    recurrencePaused: Boolean(prefsRow?.recurrence_paused_at),
    skippedNominalDates: recentSkips.map((row) => row.nominalDate),
    recentSkips,
  };
}

export async function loadRecurrenceCycleModifiers(
  supabase: SupabaseClient,
  groupId: string,
): Promise<RecurrenceCycleModifiers> {
  const batch = await loadRecurrenceCycleModifiersByGroupIds(supabase, [groupId]);
  return (
    batch.get(groupId) ?? {
      recurrencePaused: false,
      skippedNominalDates: [],
      recentSkips: [],
    }
  );
}

/** Batched recurrence pause + skip rows for list/dashboard surfaces. */
export async function loadRecurrenceCycleModifiersByGroupIds(
  supabase: SupabaseClient,
  groupIds: string[],
): Promise<Map<string, RecurrenceCycleModifiers>> {
  const modifiersByGroup = new Map<string, RecurrenceCycleModifiers>();
  if (groupIds.length === 0) {
    return modifiersByGroup;
  }

  const [prefsResult, skipsResult] = await Promise.all([
    supabase
      .from("group_recurrence_preferences")
      .select("group_id, recurrence_paused_at")
      .in("group_id", groupIds),
    supabase
      .from("group_planning_cycle_skips")
      .select("group_id, nominal_date, reason")
      .in("group_id", groupIds)
      .order("nominal_date", { ascending: false }),
  ]);

  if (prefsResult.error) {
    throw new Error(prefsResult.error.message);
  }
  if (skipsResult.error) {
    throw new Error(skipsResult.error.message);
  }

  const prefsByGroup = new Map<string, { recurrence_paused_at?: string | null }>();
  for (const row of prefsResult.data ?? []) {
    prefsByGroup.set(row.group_id as string, row);
  }

  const skipsByGroup = new Map<string, Array<{ nominal_date: string; reason: string | null }>>();
  for (const row of skipsResult.data ?? []) {
    const groupId = row.group_id as string;
    const list = skipsByGroup.get(groupId) ?? [];
    list.push({
      nominal_date: row.nominal_date as string,
      reason: (row.reason as string | null) ?? null,
    });
    skipsByGroup.set(groupId, list);
  }

  for (const groupId of groupIds) {
    modifiersByGroup.set(
      groupId,
      mapRecurrenceCycleModifiers(prefsByGroup.get(groupId), skipsByGroup.get(groupId) ?? []),
    );
  }

  return modifiersByGroup;
}

export async function persistGroupPlanningSnapshot(
  supabase: SupabaseClient,
  groupId: string,
  cycle: GroupPlanningCycle,
  options?: { serviceRole?: boolean },
): Promise<void> {
  if (options?.serviceRole) {
    const { error } = await supabase.from("group_planning_cycle_snapshots").upsert({
      group_id: groupId,
      next_nominal_date: cycle.nextTargetDate,
      planning_opens_on: cycle.planningOpensOn,
      phase: cycle.phase,
      derived_at: new Date().toISOString(),
      derivation_version: 1,
    });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

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
  options?: { serviceRole?: boolean },
): Promise<GroupPlanningCycle> {
  const events = (eventRows ?? []).map((row) => mapPlanningEventRow(row));
  const cycle = buildGroupPlanningCycle(settings, events, modifiers);
  await persistGroupPlanningSnapshot(supabase, groupId, cycle, options);
  return cycle;
}
