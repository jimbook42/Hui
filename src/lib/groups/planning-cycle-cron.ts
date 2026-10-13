import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mapGroupSettingsRow } from "@/lib/groups/map-settings";
import {
  loadRecurrenceCycleModifiers,
  rebuildAndPersistGroupPlanningSnapshot,
} from "@/lib/groups/planning-cycle-snapshot";
import { mapPlanningEventRow } from "@/lib/groups/planning-cycle";

export type PlanningCycleCronSummary = {
  groupsScanned: number;
  snapshotsRefreshed: number;
  nudgesQueued: number;
  staleProposalNudges: number;
  staleProposalsCancelled: number;
  proposalDeadlineRemindersQueued: number;
};

const GROUP_SETTINGS_SELECT = `
  group_id,
  who_may_propose,
  one_off_events_allowed,
  recurring_events_enabled,
  maybe_responses_enabled,
  minimum_attendees,
  proposal_deadline_hours,
  consensus_rule,
  admin_veto_enabled,
  host_veto_enabled,
  hosting_enabled,
  avoid_consecutive_hosts,
  timezone,
  reconnect_reminders_enabled,
  reconnect_after_days,
  recurrence_interval_unit,
  recurrence_interval_count,
  recurrence_anchor_date,
  planning_lead_days,
  canonical_recurrence_series_id
`;

export async function refreshAllGroupPlanningSnapshots(
  supabase: SupabaseClient,
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("group_settings")
    .select(GROUP_SETTINGS_SELECT)
    .eq("recurring_events_enabled", true)
    .not("recurrence_anchor_date", "is", null)
    .not("recurrence_interval_unit", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  let refreshed = 0;
  for (const row of rows ?? []) {
    const groupId = row.group_id as string;
    const settings = mapGroupSettingsRow(row as Parameters<typeof mapGroupSettingsRow>[0]);

    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select("id, status, planning_target_date, starts_at, recurrence_series_id")
      .eq("group_id", groupId)
      .neq("status", "cancelled");

    if (eventsError) {
      throw new Error(eventsError.message);
    }

    const modifiers = await loadRecurrenceCycleModifiers(supabase, groupId);
    await rebuildAndPersistGroupPlanningSnapshot(
      supabase,
      groupId,
      settings,
      (eventRows ?? []) as Parameters<typeof mapPlanningEventRow>[0][],
      modifiers,
      { serviceRole: true },
    );
    refreshed += 1;
  }

  return refreshed;
}

export async function runPlanningCycleCron(
  supabase: SupabaseClient,
  asOfDate?: string,
): Promise<PlanningCycleCronSummary> {
  const { data: groupsScanned, error: countError } = await supabase.rpc(
    "refresh_all_group_planning_snapshots",
  );
  if (countError) {
    throw new Error(countError.message);
  }

  const snapshotsRefreshed = await refreshAllGroupPlanningSnapshots(supabase);

  const { data: nudgesQueued, error: nudgeError } = await supabase.rpc(
    "enqueue_planning_cycle_nudges",
    { p_as_of: asOfDate ?? undefined },
  );
  if (nudgeError) {
    throw new Error(nudgeError.message);
  }

  const { data: staleRows, error: staleError } = await supabase.rpc(
    "process_stale_proposals",
    { p_as_of: asOfDate ?? undefined },
  );
  if (staleError) {
    throw new Error(staleError.message);
  }

  const staleRow = Array.isArray(staleRows) ? staleRows[0] : staleRows;
  const staleProposalNudges =
    staleRow && typeof staleRow === "object" && "nudges_queued" in staleRow
      ? Number((staleRow as { nudges_queued: number }).nudges_queued)
      : 0;
  const staleProposalsCancelled =
    staleRow && typeof staleRow === "object" && "proposals_cancelled" in staleRow
      ? Number((staleRow as { proposals_cancelled: number }).proposals_cancelled)
      : 0;

  if (staleProposalsCancelled > 0) {
    await refreshAllGroupPlanningSnapshots(supabase);
  }

  const { data: proposalDeadlineRemindersQueued, error: reminderError } = await supabase.rpc(
    "enqueue_proposal_deadline_reminders",
    { p_as_of: asOfDate ? `${asOfDate}T12:00:00Z` : undefined },
  );
  if (reminderError) {
    throw new Error(reminderError.message);
  }

  return {
    groupsScanned: typeof groupsScanned === "number" ? groupsScanned : snapshotsRefreshed,
    snapshotsRefreshed,
    nudgesQueued: typeof nudgesQueued === "number" ? nudgesQueued : 0,
    staleProposalNudges,
    staleProposalsCancelled,
    proposalDeadlineRemindersQueued:
      typeof proposalDeadlineRemindersQueued === "number" ? proposalDeadlineRemindersQueued : 0,
  };
}
