import type { GroupSettingsRow } from "./types";

/** Maps group_settings row columns shared by query helpers. */
export function mapGroupSettingsRow(row: Record<string, unknown>): GroupSettingsRow {
  const intervalUnit = row.recurrence_interval_unit;
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
    recurrenceIntervalUnit:
      intervalUnit === "week" || intervalUnit === "month" ? intervalUnit : null,
    recurrenceIntervalCount:
      row.recurrence_interval_count === null || row.recurrence_interval_count === undefined
        ? null
        : Number(row.recurrence_interval_count),
    recurrenceAnchorDate:
      typeof row.recurrence_anchor_date === "string" ? row.recurrence_anchor_date : null,
    planningLeadDays:
      row.planning_lead_days === null || row.planning_lead_days === undefined
        ? 14
        : Number(row.planning_lead_days),
    canonicalRecurrenceSeriesId:
      typeof row.canonical_recurrence_series_id === "string"
        ? row.canonical_recurrence_series_id
        : null,
  };
}
