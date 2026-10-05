import {
  cadenceFromParts,
  deriveGroupPlanningCycle,
  type GroupPlanningCycle,
  type GroupPlanningEventSnapshot,
  shouldShowPlanNextCta,
} from "@/domain/recurrence/planning-cycle";
import type { GroupSettingsRow } from "@/lib/groups/types";
export type { GroupPlanningCycle };

export function todayDateOnlyInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function cadenceFromGroupSettings(settings: GroupSettingsRow) {
  return cadenceFromParts(
    settings.recurrenceIntervalUnit,
    settings.recurrenceIntervalCount,
    settings.recurrenceAnchorDate,
  );
}

export function buildGroupPlanningCycle(
  settings: GroupSettingsRow,
  events: GroupPlanningEventSnapshot[],
  now: Date = new Date(),
): GroupPlanningCycle {
  const today = todayDateOnlyInTimeZone(settings.timezone, now);
  return deriveGroupPlanningCycle({
    recurringEnabled: settings.recurringEventsEnabled,
    cadence: cadenceFromGroupSettings(settings),
    planningLeadDays: settings.planningLeadDays,
    todayDateOnly: today,
    events,
  });
}

export { shouldShowPlanNextCta };

export function formatNominalPlanningDate(dateOnly: string, timeZone: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const instant = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    day: "numeric",
    month: "long",
  }).format(instant);
}

export function mapPlanningEventRow(row: {
  id: string;
  status: string;
  planning_target_date: string | null;
  starts_at: string | null;
  recurrence_series_id: string | null;
}): GroupPlanningEventSnapshot {
  return {
    id: row.id,
    status: row.status,
    planningTargetDate: row.planning_target_date,
    startsAt: row.starts_at,
    recurrenceSeriesId: row.recurrence_series_id,
  };
}
