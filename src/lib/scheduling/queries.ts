import type { SupabaseClient } from "@supabase/supabase-js";

import { dbResponseToAvailability } from "@/domain/scheduling/mapping";
import type { AvailabilityChoice, DbResponseValue } from "@/domain/scheduling/types";
import { ACTIVE_CANDIDATE_STATUSES } from "@/domain/scheduling/types";

import type { EventCandidateRow, EventSchedulingContext } from "./types";

export async function getEventSchedulingContext(
  supabase: SupabaseClient,
  eventId: string,
  groupId: string,
  viewerId: string,
): Promise<EventSchedulingContext> {
  const { data: settings, error: settingsError } = await supabase
    .from("group_settings")
    .select("maybe_responses_enabled, minimum_attendees, consensus_rule")
    .eq("group_id", groupId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from("event_candidates")
    .select("id, starts_at, ends_at, status, proposed_by, created_at")
    .eq("event_id", eventId)
    .in("status", [...ACTIVE_CANDIDATE_STATUSES])
    .order("starts_at", { ascending: true });

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const candidateIds = (candidates ?? []).map((row) => row.id as string);
  const responsesByCandidate = new Map<string, AvailabilityChoice>();

  if (candidateIds.length > 0) {
    const { data: responses, error: responsesError } = await supabase
      .from("event_responses")
      .select("candidate_id, response")
      .eq("user_id", viewerId)
      .in("candidate_id", candidateIds);

    if (responsesError) {
      throw new Error(responsesError.message);
    }

    for (const row of responses ?? []) {
      responsesByCandidate.set(
        row.candidate_id as string,
        dbResponseToAvailability(row.response as DbResponseValue),
      );
    }
  }

  const mapped: EventCandidateRow[] = (candidates ?? []).map((row) => ({
    id: row.id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as EventCandidateRow["status"],
    proposedBy: row.proposed_by as string,
    createdAt: row.created_at as string,
    viewerResponse: responsesByCandidate.get(row.id as string) ?? null,
  }));

  return {
    candidates: mapped,
    maybeResponsesEnabled: Boolean(settings?.maybe_responses_enabled),
    minimumAttendees: Number(settings?.minimum_attendees ?? 1),
    consensusRule: (settings?.consensus_rule ??
      "minimum_attendees") as EventSchedulingContext["consensusRule"],
  };
}
