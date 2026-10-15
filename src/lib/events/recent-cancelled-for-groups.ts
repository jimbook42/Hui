import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RECENT_CANCELLED_PER_GROUP_CARD_CAP,
  recentCancelledCutoffIso,
} from "@/domain/events/recent-cancelled";

const DEFAULT_TIME_ZONE = "Pacific/Auckland";

export type RecentCancelledGroupEvent = {
  id: string;
  title: string;
  groupId: string;
  startsAt: string | null;
  timeZone: string;
  cancelledAt: string;
};

type CancelledEventRow = {
  id: string;
  title: string;
  group_id: string;
  starts_at: string | null;
  timezone: string | null;
  cancelled_at: string | null;
  planning_target_date: string | null;
};

/** Display time for cancelled hui that never reached `events.starts_at`. */
export function resolveCancelledEventStartsAt(
  row: Pick<CancelledEventRow, "starts_at" | "planning_target_date">,
  earliestCandidateStart: string | null | undefined,
): string | null {
  if (row.starts_at) {
    return row.starts_at;
  }
  if (earliestCandidateStart) {
    return earliestCandidateStart;
  }
  const nominal = row.planning_target_date?.trim();
  if (nominal) {
    return `${nominal}T12:00:00.000Z`;
  }
  return null;
}

/** Group recent cancelled rows by group, capped per group (most recent cancellation first). */
export function indexRecentCancelledByGroup(
  rows: CancelledEventRow[],
  now: Date,
  perGroupCap = RECENT_CANCELLED_PER_GROUP_CARD_CAP,
  earliestCandidateByEventId: ReadonlyMap<string, string> = new Map(),
): Map<string, RecentCancelledGroupEvent[]> {
  const cutoffMs = new Date(recentCancelledCutoffIso(now)).getTime();
  const sorted = rows
    .filter((row) => {
      if (!row.cancelled_at) {
        return false;
      }
      return new Date(row.cancelled_at).getTime() >= cutoffMs;
    })
    .sort((a, b) => {
      const aAt = a.cancelled_at ? new Date(a.cancelled_at).getTime() : 0;
      const bAt = b.cancelled_at ? new Date(b.cancelled_at).getTime() : 0;
      return bAt - aAt;
    });

  const byGroup = new Map<string, RecentCancelledGroupEvent[]>();
  for (const row of sorted) {
    if (!row.cancelled_at) {
      continue;
    }
    const list = byGroup.get(row.group_id) ?? [];
    if (list.length >= perGroupCap) {
      continue;
    }
    list.push({
      id: row.id,
      title: row.title,
      groupId: row.group_id,
      startsAt: resolveCancelledEventStartsAt(
        row,
        earliestCandidateByEventId.get(row.id),
      ),
      timeZone:
        row.timezone && row.timezone.length > 0 ? row.timezone : DEFAULT_TIME_ZONE,
      cancelledAt: row.cancelled_at,
    });
    byGroup.set(row.group_id, list);
  }
  return byGroup;
}

async function loadEarliestCandidateStartsByEvent(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, string>> {
  const byEvent = new Map<string, string>();
  if (eventIds.length === 0) {
    return byEvent;
  }

  const { data, error } = await supabase
    .from("event_candidates")
    .select("event_id, starts_at")
    .in("event_id", eventIds)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const eventId = String(row.event_id);
    if (!byEvent.has(eventId) && row.starts_at) {
      byEvent.set(eventId, String(row.starts_at));
    }
  }
  return byEvent;
}

/**
 * One batched load of recent cancelled hui for many groups (30-day window, per-group cap in memory).
 * Used by /groups so each card can show cancellations alongside the next upcoming hui.
 */
export async function loadRecentCancelledEventsForGroups(
  supabase: SupabaseClient,
  groupIds: string[],
  options: {
    now?: Date;
    perGroupCap?: number;
  } = {},
): Promise<Map<string, RecentCancelledGroupEvent[]>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  const now = options.now ?? new Date();
  const perGroupCap = options.perGroupCap ?? RECENT_CANCELLED_PER_GROUP_CARD_CAP;
  const cutoff = recentCancelledCutoffIso(now);
  const fetchLimit = groupIds.length * perGroupCap;

  const { data, error } = await supabase
    .from("events")
    .select("id, title, group_id, starts_at, timezone, cancelled_at, planning_target_date")
    .in("group_id", groupIds)
    .eq("status", "cancelled")
    .gte("cancelled_at", cutoff)
    .order("cancelled_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CancelledEventRow[];
  const needsCandidate = rows.filter((row) => !row.starts_at).map((row) => row.id);
  const earliestCandidateByEventId = await loadEarliestCandidateStartsByEvent(
    supabase,
    needsCandidate,
  );

  return indexRecentCancelledByGroup(rows, now, perGroupCap, earliestCandidateByEventId);
}
