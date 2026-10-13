import type { SupabaseClient } from "@supabase/supabase-js";

/** Number of confirmed-time reschedules (drives ICS SEQUENCE). */
export async function countEventNewTimeReschedules(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("event_reschedule_audit")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("mode", "new_time");

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}
