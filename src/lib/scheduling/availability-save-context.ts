import type { SupabaseClient } from "@supabase/supabase-js";

import { canRespondToCandidates } from "@/domain/scheduling/permissions";
import type { EventStatus } from "@/domain/events/types";
import { getGroupResponseSettings } from "@/lib/groups/response-settings";

export type AvailabilitySaveContext = {
  groupId: string;
  eventStatus: EventStatus;
  timeZone: string;
  maybeResponsesEnabled: boolean;
};

export type AvailabilitySaveContextResult =
  | { ok: true; context: AvailabilitySaveContext }
  | { ok: false; error: string };

/**
 * Minimal reads for setAvailabilityResponseAction — avoids full getEventDetail (series, profile, …).
 */
export async function loadAvailabilitySaveContext(
  supabase: SupabaseClient,
  eventId: string,
  candidateId?: string,
): Promise<AvailabilitySaveContextResult> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("group_id, status, timezone")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return { ok: false, error: eventError.message };
  }
  if (!event) {
    return { ok: false, error: "Event not found." };
  }

  const groupId = event.group_id as string;
  const eventStatus = event.status as EventStatus;

  if (!canRespondToCandidates(eventStatus)) {
    return { ok: false, error: "This event is no longer accepting availability responses." };
  }

  const [responseSettings, candidateResult] = await Promise.all([
    getGroupResponseSettings(supabase, groupId),
    candidateId
      ? supabase
          .from("event_candidates")
          .select("id, status")
          .eq("id", candidateId)
          .eq("event_id", eventId)
          .eq("group_id", groupId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!responseSettings) {
    return { ok: false, error: "You do not have access to this group." };
  }

  if (candidateId) {
    if (candidateResult.error) {
      return { ok: false, error: candidateResult.error.message };
    }
    const candidate = candidateResult.data;
    if (!candidate) {
      return { ok: false, error: "Candidate not found." };
    }
    if (candidate.status !== "proposed" && candidate.status !== "selected") {
      return { ok: false, error: "This candidate is no longer open for responses." };
    }
  }

  return {
    ok: true,
    context: {
      groupId,
      eventStatus,
      timeZone: (event.timezone as string | null) ?? "Pacific/Auckland",
      maybeResponsesEnabled: responseSettings.maybeResponsesEnabled,
    },
  };
}
