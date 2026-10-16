import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

import { isEventId } from "@/lib/events/event-id";
import { getEventDetail } from "@/lib/events/queries";
import type { EventDetail } from "@/lib/events/types";

/** Validates the route id and loads the event for an active group member, or triggers 404. */
export async function requireEventDetail(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<EventDetail> {
  if (!isEventId(eventId)) {
    notFound();
  }
  const detail = await getEventDetail(supabase, eventId, userId);
  if (!detail) {
    notFound();
  }
  return detail;
}
