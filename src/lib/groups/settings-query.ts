import type { SupabaseClient } from "@supabase/supabase-js";

import type { GroupSettingsRow } from "./types";

function mapSettings(row: Record<string, unknown>): GroupSettingsRow {
  return {
    whoMayPropose: row.who_may_propose as GroupSettingsRow["whoMayPropose"],
    oneOffEventsAllowed: Boolean(row.one_off_events_allowed),
    recurringEventsEnabled: Boolean(row.recurring_events_enabled),
    maybeResponsesEnabled: Boolean(row.maybe_responses_enabled),
    minimumAttendees: Number(row.minimum_attendees),
    proposalDeadlineHours:
      row.proposal_deadline_hours === null
        ? null
        : Number(row.proposal_deadline_hours),
    consensusRule: row.consensus_rule as GroupSettingsRow["consensusRule"],
    adminVetoEnabled: Boolean(row.admin_veto_enabled),
    hostVetoEnabled: Boolean(row.host_veto_enabled),
    hostingEnabled: row.hosting_enabled !== false,
    avoidConsecutiveHosts: Boolean(row.avoid_consecutive_hosts),
    timezone:
      typeof row.timezone === "string" && row.timezone.length > 0
        ? row.timezone
        : "Pacific/Auckland",
    reconnectRemindersEnabled: Boolean(row.reconnect_reminders_enabled),
    reconnectAfterDays:
      row.reconnect_after_days === null ? null : Number(row.reconnect_after_days),
  };
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
