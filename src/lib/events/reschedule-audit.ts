import type { SupabaseClient } from "@supabase/supabase-js";

export type EventRescheduleFrom = {
  startsAt: string;
  endsAt: string | null;
};

export async function getLatestRescheduleFrom(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventRescheduleFrom | null> {
  const { data, error } = await supabase
    .from("event_reschedule_audit")
    .select("from_starts_at, from_ends_at")
    .eq("event_id", eventId)
    .not("from_starts_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.from_starts_at) {
    return null;
  }

  return {
    startsAt: data.from_starts_at as string,
    endsAt: (data.from_ends_at as string | null) ?? null,
  };
}
