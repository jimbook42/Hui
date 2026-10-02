import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compareCandidatesBySchedule,
  isConsensusRule,
  type ConsensusFailureReason,
  type ConsensusRule,
} from "@/domain/scheduling/consensus";
import { dbResponseToAvailability } from "@/domain/scheduling/mapping";
import type { AvailabilityChoice, DbResponseValue } from "@/domain/scheduling/types";
import { ACTIVE_CANDIDATE_STATUSES } from "@/domain/scheduling/types";

import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";

import type {
  CandidateConsensusView,
  EventCandidateRow,
  EventConsensusSummary,
  EventSchedulingContext,
} from "./types";

export async function getCandidateAttendanceRoster(
  supabase: SupabaseClient,
  candidateId: string,
): Promise<AttendanceRoster | null> {
  const { data, error } = await supabase.rpc("candidate_attendance_roster", {
    p_candidate_id: candidateId,
  });

  if (error || !data) {
    return null;
  }

  const summary =
    typeof data === "string" ? (JSON.parse(data) as Record<string, unknown>) : data;
  const membersRaw = Array.isArray(summary.members) ? summary.members : [];
  const members = membersRaw.map((row: unknown) => {
    const record = row as Record<string, unknown>;
    const response = record.response;
    return {
      userId: String(record.user_id ?? ""),
      displayName: String(record.display_name ?? "Member"),
      response:
        response === "yes" || response === "no" || response === "maybe"
          ? response
          : null,
    };
  });

  return {
    maybeResponsesEnabled: summary.maybe_responses_enabled !== false,
    members,
  };
}

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

  const candidateSelect =
    "id, starts_at, ends_at, status, proposed_by, created_at";

  const [{ data: candidates, error: candidatesError }, { data: withdrawn, error: withdrawnError }] =
    await Promise.all([
      supabase
        .from("event_candidates")
        .select(candidateSelect)
        .eq("event_id", eventId)
        .in("status", [...ACTIVE_CANDIDATE_STATUSES])
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("event_candidates")
        .select(candidateSelect)
        .eq("event_id", eventId)
        .eq("status", "withdrawn")
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }
  if (withdrawnError) {
    throw new Error(withdrawnError.message);
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

  const mapCandidate = (row: Record<string, unknown>): EventCandidateRow => ({
    id: row.id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as EventCandidateRow["status"],
    proposedBy: row.proposed_by as string,
    createdAt: row.created_at as string,
    viewerResponse: responsesByCandidate.get(row.id as string) ?? null,
  });

  const mapped: EventCandidateRow[] = (candidates ?? []).map((row) =>
    mapCandidate(row as Record<string, unknown>),
  );
  const withdrawnMapped: EventCandidateRow[] = (withdrawn ?? []).map((row) =>
    mapCandidate(row as Record<string, unknown>),
  );

  return {
    candidates: mapped,
    withdrawnCandidates: withdrawnMapped,
    maybeResponsesEnabled: Boolean(settings?.maybe_responses_enabled),
    minimumAttendees: Number(settings?.minimum_attendees ?? 1),
    consensusRule: (settings?.consensus_rule ??
      "minimum_attendees") as EventSchedulingContext["consensusRule"],
  };
}

const FAILURE_REASONS = new Set<CandidateConsensusView["failureReason"]>([
  "below_minimum_attendees",
  "required_participants",
  "all_active_members",
  "candidate_not_active",
  null,
]);

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return JSON.parse(value) as Record<string, unknown>;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Consensus summary was not returned.");
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Consensus summary was incomplete.");
  }
  return parsed;
}

function readRule(value: unknown): ConsensusRule {
  if (typeof value === "string" && isConsensusRule(value)) {
    return value;
  }
  throw new Error("Consensus summary was incomplete.");
}

function readFailureReason(value: unknown): CandidateConsensusView["failureReason"] {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && FAILURE_REASONS.has(value as ConsensusFailureReason)) {
    return value as CandidateConsensusView["failureReason"];
  }
  throw new Error("Consensus summary was incomplete.");
}

function readCandidate(value: unknown): CandidateConsensusView {
  const row = readRecord(value);
  const startsAt = String(row.starts_at ?? "");
  const candidateId = String(row.candidate_id ?? "");
  if (!candidateId || !startsAt) {
    throw new Error("Consensus summary was incomplete.");
  }
  return {
    candidateId,
    startsAt,
    endsAt: String(row.ends_at ?? ""),
    passes: row.passes === true,
    acceptedCount: readNumber(row.accepted_count),
    maybeCount: readNumber(row.maybe_count),
    unavailableCount: readNumber(row.unavailable_count),
    noResponseCount: readNumber(row.no_response_count),
    eligibleMemberCount: readNumber(row.eligible_member_count),
    minimumAttendees: readNumber(row.minimum_attendees),
    consensusRule: readRule(row.consensus_rule),
    maybeResponsesEnabled: row.maybe_responses_enabled === true,
    requiredParticipantCount: readNumber(row.required_participant_count),
    requiredAcceptedCount: readNumber(row.required_accepted_count),
    failureReason: readFailureReason(row.failure_reason),
  };
}

export async function getEventConsensusSummary(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventConsensusSummary> {
  const { data, error } = await supabase.rpc("event_consensus_summary", {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const summary = readRecord(data);
  const rawCandidates = Array.isArray(summary.candidates) ? summary.candidates : [];
  const candidates = rawCandidates.map(readCandidate).sort((a, b) =>
    compareCandidatesBySchedule(
      { id: a.candidateId, startsAt: a.startsAt },
      { id: b.candidateId, startsAt: b.startsAt },
    ),
  );

  return {
    eligibleMemberCount: readNumber(summary.eligible_member_count),
    minimumAttendees: readNumber(summary.minimum_attendees),
    consensusRule: readRule(summary.consensus_rule),
    maybeResponsesEnabled: summary.maybe_responses_enabled === true,
    candidates,
  };
}
