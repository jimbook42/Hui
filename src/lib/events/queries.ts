import type { SupabaseClient } from "@supabase/supabase-js";

import { coordinatesFromRow } from "@/domain/events/location";
import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";

import type { EventDetail, EventListItem, RecurrenceSeriesSummary } from "./types";

function mapSeries(row: Record<string, unknown>): RecurrenceSeriesSummary {
  return {
    id: row.id as string,
    title: row.title as string,
    intervalUnit: row.interval_unit as RecurrenceSeriesSummary["intervalUnit"],
    intervalCount: Number(row.interval_count),
    startsOn: row.starts_on as string,
    endsOn: row.ends_on === null ? null : (row.ends_on as string),
    archivedAt: row.archived_at === null ? null : (row.archived_at as string),
  };
}

export async function listEventsForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<EventListItem[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      status,
      recurrence_series_id,
      created_at,
      created_by,
      profiles:created_by (
        display_name
      )
    `,
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const rawProfile = row.profiles as
      | { display_name: string }
      | { display_name: string }[]
      | null;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as EventStatus,
      kind: row.recurrence_series_id ? "recurring" : "one_off",
      createdAt: row.created_at as string,
      creatorDisplayName: profile?.display_name ?? "Member",
    };
  });
}

export async function getEventDetail(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<EventDetail | null> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      `
      id,
      group_id,
      title,
      status,
      location,
      location_lat,
      location_lng,
      notes,
      starts_at,
      ends_at,
      timezone,
      created_by,
      recurrence_series_id,
      created_at,
      updated_at,
      cancelled_at,
      groups:group_id (
        name
      ),
      profiles:created_by (
        display_name
      )
    `,
    )
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(eventError.message);
  }
  if (!event) {
    return null;
  }

  const groupId = event.group_id as string;
  const seriesId = event.recurrence_series_id as string | null;

  const [membershipResult, seriesResult] = await Promise.all([
    supabase
      .from("group_memberships")
      .select("role, status")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
    seriesId
      ? supabase
          .from("recurrence_series")
          .select(
            "id, title, interval_unit, interval_count, starts_on, ends_on, archived_at",
          )
          .eq("id", seriesId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const { data: membership, error: membershipError } = membershipResult;
  if (membershipError) {
    throw new Error(membershipError.message);
  }
  if (!membership || membership.status !== "active") {
    return null;
  }

  let recurrenceSeries: RecurrenceSeriesSummary | null = null;
  if (seriesResult.error) {
    throw new Error(seriesResult.error.message);
  }
  if (seriesResult.data) {
    recurrenceSeries = mapSeries(seriesResult.data);
  }

  const rawGroup = event.groups as { name: string } | { name: string }[] | null;
  const group = Array.isArray(rawGroup) ? rawGroup[0] : rawGroup;
  const rawProfile = event.profiles as
    | { display_name: string }
    | { display_name: string }[]
    | null;
  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

  return {
    id: event.id as string,
    groupId,
    groupName: group?.name ?? "Group",
    title: event.title as string,
    status: event.status as EventStatus,
    kind: event.recurrence_series_id ? "recurring" : "one_off",
    location: event.location as string | null,
    locationCoordinates: coordinatesFromRow(
      event.location_lat as number | null,
      event.location_lng as number | null,
    ),
    notes: event.notes as string | null,
    startsAt: event.starts_at as string | null,
    endsAt: event.ends_at as string | null,
    timezone:
      typeof event.timezone === "string" && event.timezone.length > 0
        ? event.timezone
        : null,
    createdBy: event.created_by as string,
    creatorDisplayName: profile?.display_name ?? "Member",
    recurrenceSeries,
    createdAt: event.created_at as string,
    updatedAt: event.updated_at as string,
    cancelledAt: event.cancelled_at as string | null,
    viewerRole: membership.role as MembershipRole,
  };
}
