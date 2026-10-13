import type { SupabaseClient } from "@supabase/supabase-js";

import type { StandingAvailabilityWindow } from "@/domain/scheduling/standing-availability";

type StandingRow = {
  id: string;
  group_id: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  kind: "usually_available" | "usually_unavailable";
};

function mapRow(row: StandingRow): StandingAvailabilityWindow {
  return {
    id: row.id,
    groupId: row.group_id,
    dayOfWeek: row.day_of_week,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    kind: row.kind,
  };
}

export async function listMyStandingAvailabilityForGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
): Promise<StandingAvailabilityWindow[]> {
  const { data, error } = await supabase
    .from("group_member_standing_availability")
    .select("id, group_id, day_of_week, start_minute, end_minute, kind")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .order("day_of_week")
    .order("start_minute");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRow(row as StandingRow));
}

export async function listMyStandingAvailability(
  supabase: SupabaseClient,
  userId: string,
): Promise<StandingAvailabilityWindow[]> {
  const { data, error } = await supabase
    .from("group_member_standing_availability")
    .select("id, group_id, day_of_week, start_minute, end_minute, kind")
    .eq("user_id", userId)
    .order("group_id")
    .order("day_of_week")
    .order("start_minute");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRow(row as StandingRow));
}
