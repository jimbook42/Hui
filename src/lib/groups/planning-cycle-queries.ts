import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canProposeEvents } from "@/domain/events/permissions";
import { canEditSettings, type MembershipRole } from "@/domain/groups/permissions";
import { buildNominalDatePreview, type NominalPreviewRow } from "@/domain/recurrence/nominal-preview";
import {
  loadRecurrenceCycleModifiers,
  loadRecurrenceCycleModifiersByGroupIds,
  type PlanningCycleSkipRecord,
  type RecurrenceCycleModifiers,
} from "@/lib/groups/planning-cycle-snapshot";
import { getGroupSettingsByGroupId, listGroupSettingsByGroupIds } from "@/lib/groups/settings-query";
import {
  buildGroupPlanningCycle,
  mapPlanningEventRow,
  shouldShowPlanNextCta,
  todayDateOnlyInTimeZone,
  type GroupPlanningCycle,
} from "@/lib/groups/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";

export type GroupPlanningContext = {
  groupId: string;
  groupName: string;
  viewerRole: MembershipRole;
  settings: GroupSettingsRow;
  cycle: GroupPlanningCycle;
  canPropose: boolean;
  showPlanCta: boolean;
  canManageRecurrence: boolean;
  recurrencePaused: boolean;
  recentSkips: PlanningCycleSkipRecord[];
  upcomingNominals: NominalPreviewRow[];
};

type PlanningGroupRef = {
  id: string;
  name: string;
  role: MembershipRole;
};

function buildGroupPlanningContext(
  group: PlanningGroupRef,
  settings: GroupSettingsRow,
  eventRows: Parameters<typeof mapPlanningEventRow>[0][] | undefined,
  modifiers: RecurrenceCycleModifiers,
): GroupPlanningContext {
  const events = (eventRows ?? []).map((row) => mapPlanningEventRow(row));
  const cycle = buildGroupPlanningCycle(settings, events, modifiers);
  const canPropose = canProposeEvents(group.role, settings);
  const recurrencePaused = Boolean(modifiers.recurrencePaused);
  const skipReasons = Object.fromEntries(
    modifiers.recentSkips.map((skip) => [skip.nominalDate, skip.reason]),
  );
  const upcomingNominals =
    cycle.cadence && cycle.phase !== "not_recurring"
      ? buildNominalDatePreview({
          cadence: cycle.cadence,
          cycle,
          todayDateOnly: todayDateOnlyInTimeZone(settings.timezone),
          events,
          skippedNominalDates: modifiers.skippedNominalDates ?? [],
          skipReasons,
          count: 4,
        })
      : [];

  return {
    groupId: group.id,
    groupName: group.name,
    viewerRole: group.role,
    settings,
    cycle,
    canPropose,
    showPlanCta: canPropose && shouldShowPlanNextCta(cycle) && !recurrencePaused,
    canManageRecurrence: canEditSettings(group.role),
    recurrencePaused,
    recentSkips: modifiers.recentSkips,
    upcomingNominals,
  };
}

export async function loadGroupPlanningContext(
  supabase: SupabaseClient,
  groupId: string,
  _userId: string,
  groupName: string,
  viewerRole: MembershipRole,
): Promise<GroupPlanningContext | null> {
  const settings = await getGroupSettingsByGroupId(supabase, groupId);
  if (!settings) {
    return null;
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

  return buildGroupPlanningContext(
    { id: groupId, name: groupName, role: viewerRole },
    settings,
    (eventRows ?? []) as Parameters<typeof mapPlanningEventRow>[0][],
    modifiers,
  );
}

async function resolvePlanningGroups(
  supabase: SupabaseClient,
  userId: string,
  groups?: PlanningGroupRef[],
): Promise<PlanningGroupRef[]> {
  if (groups && groups.length > 0) {
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      role: group.role,
    }));
  }

  const { data: memberships, error } = await supabase
    .from("group_memberships")
    .select(
      `
      role,
      groups:group_id (
        id,
        name
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const resolved: PlanningGroupRef[] = [];
  for (const row of memberships ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (!group) {
      continue;
    }
    resolved.push({
      id: group.id,
      name: group.name,
      role: row.role as MembershipRole,
    });
  }
  return resolved;
}

export async function loadDashboardRecurringPlanning(
  supabase: SupabaseClient,
  userId: string,
  options?: { groups?: PlanningGroupRef[] },
): Promise<GroupPlanningContext[]> {
  const planningGroups = await resolvePlanningGroups(supabase, userId, options?.groups);
  if (planningGroups.length === 0) {
    return [];
  }

  const groupIds = planningGroups.map((group) => group.id);

  const [settingsByGroup, eventsResult, modifiersByGroup] = await Promise.all([
    listGroupSettingsByGroupIds(supabase, groupIds),
    supabase
      .from("events")
      .select("id, status, planning_target_date, starts_at, recurrence_series_id, group_id")
      .in("group_id", groupIds)
      .neq("status", "cancelled"),
    loadRecurrenceCycleModifiersByGroupIds(supabase, groupIds),
  ]);

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const eventsByGroup = new Map<string, Parameters<typeof mapPlanningEventRow>[0][]>();
  for (const row of eventsResult.data ?? []) {
    const groupId = row.group_id as string;
    const list = eventsByGroup.get(groupId) ?? [];
    list.push(row as Parameters<typeof mapPlanningEventRow>[0]);
    eventsByGroup.set(groupId, list);
  }

  const contexts: GroupPlanningContext[] = [];
  for (const group of planningGroups) {
    const settings = settingsByGroup.get(group.id);
    if (!settings) {
      continue;
    }
    const context = buildGroupPlanningContext(
      group,
      settings,
      eventsByGroup.get(group.id),
      modifiersByGroup.get(group.id) ?? {
        recurrencePaused: false,
        skippedNominalDates: [],
        recentSkips: [],
      },
    );
    if (context.cycle.phase === "not_recurring") {
      continue;
    }
    contexts.push(context);
  }

  return contexts.sort((a, b) => a.groupName.localeCompare(b.groupName));
}
