"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertCanFinalise } from "@/domain/events/lifecycle";
import { availabilityToDbResponse } from "@/domain/scheduling/mapping";
import {
  canAddCandidates,
  canFinaliseEvent,
  canRespondToCandidates,
  canWithdrawCandidate,
} from "@/domain/scheduling/permissions";
import {
  isDuplicateCandidate,
  parseAvailabilityChoice,
  parseRequiredDateTime,
  validateAvailabilityChoice,
  validateCandidateWindow,
} from "@/domain/scheduling/validation";
import { getEventDetail } from "@/lib/events/queries";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";
import { createClient } from "@/lib/supabase/server";

import type { EventActionState } from "./actions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }
  return { supabase, user };
}

export async function addCandidateAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const startsAt = parseRequiredDateTime(String(formData.get("starts_at") ?? ""));
  const endsAt = parseRequiredDateTime(String(formData.get("ends_at") ?? ""));

  if (!eventId || !groupId || !startsAt || !endsAt) {
    return { error: "Enter a valid start and end time." };
  }

  const windowError = validateCandidateWindow(startsAt, endsAt);
  if (windowError) {
    return { error: windowError };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail || detail.groupId !== groupId) {
    return { error: "Event not found." };
  }

  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group) {
    return { error: "You do not have access to this group." };
  }

  if (!canAddCandidates(detail.viewerRole, group.settings, detail.status)) {
    return { error: "You cannot add candidate times for this event." };
  }

  const scheduling = await getEventSchedulingContext(
    supabase,
    eventId,
    groupId,
    user.id,
  );
  if (
    isDuplicateCandidate(
      scheduling.candidates.map((c) => ({
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        status: c.status,
      })),
      startsAt,
      endsAt,
    )
  ) {
    return { error: "That time slot is already proposed for this event." };
  }

  const { error } = await supabase.from("event_candidates").insert({
    event_id: eventId,
    group_id: groupId,
    starts_at: startsAt,
    ends_at: endsAt,
    proposed_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { message: "Candidate time added." };
}

export async function withdrawCandidateAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const candidateId = String(formData.get("candidate_id") ?? "");

  if (!eventId || !candidateId) {
    return { error: "Missing candidate." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  if (
    !canWithdrawCandidate(
      detail.viewerRole,
      user.id,
      detail.createdBy,
      detail.status,
    )
  ) {
    return { error: "You cannot remove this candidate." };
  }

  const { data: candidate, error: fetchError } = await supabase
    .from("event_candidates")
    .select("id, status, event_id, group_id")
    .eq("id", candidateId)
    .eq("event_id", eventId)
    .eq("group_id", detail.groupId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!candidate) {
    return { error: "Candidate not found." };
  }
  if (candidate.status !== "proposed" && candidate.status !== "selected") {
    return { error: "This candidate can no longer be removed." };
  }

  const { error } = await supabase
    .from("event_candidates")
    .update({ status: "withdrawn" })
    .eq("id", candidateId)
    .eq("event_id", eventId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { message: "Candidate removed." };
}

export async function setAvailabilityResponseAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const candidateId = String(formData.get("candidate_id") ?? "");
  const choice = parseAvailabilityChoice(String(formData.get("response") ?? ""));

  if (!eventId || !candidateId || !choice) {
    return { error: "Choose a valid response." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  if (!canRespondToCandidates(detail.status)) {
    return { error: "This event is no longer accepting availability responses." };
  }

  const group = await getGroupDetail(supabase, detail.groupId, user.id);
  if (!group) {
    return { error: "You do not have access to this group." };
  }

  const maybeError = validateAvailabilityChoice(
    choice,
    group.settings.maybeResponsesEnabled,
  );
  if (maybeError) {
    return { error: maybeError };
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("event_candidates")
    .select("id, status")
    .eq("id", candidateId)
    .eq("event_id", eventId)
    .eq("group_id", detail.groupId)
    .maybeSingle();

  if (candidateError) {
    return { error: candidateError.message };
  }
  if (!candidate) {
    return { error: "Candidate not found." };
  }
  if (candidate.status !== "proposed" && candidate.status !== "selected") {
    return { error: "This candidate is no longer open for responses." };
  }

  const dbResponse = availabilityToDbResponse(choice);
  const { error } = await supabase.from("event_responses").upsert(
    {
      candidate_id: candidateId,
      user_id: user.id,
      response: dbResponse,
      visibility: "private",
    },
    { onConflict: "candidate_id,user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { message: "Response saved." };
}

export async function finaliseEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const candidateId = String(formData.get("candidate_id") ?? "");

  if (!eventId || !candidateId) {
    return { error: "Missing candidate." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  const statusError = assertCanFinalise(detail.status);
  if (statusError) {
    return { error: statusError };
  }
  if (
    !canFinaliseEvent(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot confirm this event." };
  }

  const { error } = await supabase.rpc("finalise_event", {
    p_event_id: eventId,
    p_candidate_id: candidateId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}/events`);
  return { message: "Event confirmed." };
}
