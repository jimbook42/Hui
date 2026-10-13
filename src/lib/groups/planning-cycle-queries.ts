import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canProposeEvents } from "@/domain/events/permissions";
import type { MembershipRole } from "@/domain/groups/permissions";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";
import {
  buildGroupPlanningCycle,
  mapPlanningEventRow,
  shouldShowPlanNextCta,
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
};

export async function loadGroupPlanningContext(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
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

  const events = (eventRows ?? []).map((row) =>
    mapPlanningEventRow(row as Parameters<typeof mapPlanningEventRow>[0]),
  );
  const cycle = buildGroupPlanningCycle(settings, events);
  const canPropose = canProposeEvents(viewerRole, settings);

  return {
    groupId,
    groupName,
    viewerRole,
    settings,
    cycle,
    canPropose,
    showPlanCta: canPropose && shouldShowPlanNextCta(cycle),
  };
}

export async function loadDashboardRecurringPlanning(
  supabase: SupabaseClient,
  userId: string,
): Promise<GroupPlanningContext[]> {
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

  const contexts: GroupPlanningContext[] = [];
  for (const row of memberships ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (!group) {
      continue;
    }
    const context = await loadGroupPlanningContext(
      supabase,
      group.id,
      userId,
      group.name,
      row.role as MembershipRole,
    );
    if (!context || context.cycle.phase === "not_recurring") {
      continue;
    }
    contexts.push(context);
  }

  return contexts.sort((a, b) => a.groupName.localeCompare(b.groupName));
}
