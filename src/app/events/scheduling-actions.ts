"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { isEventConfirmRule } from "@/domain/events/confirm-rule";
import { assertCanFinalise } from "@/domain/events/lifecycle";
import { availabilityToDbResponse } from "@/domain/scheduling/mapping";
import {
  canAddCandidates,
  canFinaliseEvent,
  canWithdrawCandidate,
} from "@/domain/scheduling/permissions";
import { validateCandidateStartNotPast } from "@/domain/scheduling/candidate-start-past";
import {
  isDuplicateCandidate,
  parseAvailabilityChoice,
  parseRequiredDateTime,
  normalizePrivateAttendanceNote,
  validateAvailabilityChoice,
  validateCandidateWindow,
} from "@/domain/scheduling/validation";
import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import { formatAvailabilityNudgeSuccessMessage } from "@/domain/scheduling/availability-nudge-copy";
import { friendlyFinaliseErrorMessage } from "@/domain/scheduling/finalise-errors";
import {
  canAdminPickEventTime,
  canEditEventResponseDeadline,
  canNudgeEventAvailability,
} from "@/domain/scheduling/response-deadline-permissions";
import { pickAcceptedHost } from "@/domain/hosts/display";
import { getEventHostContext } from "@/lib/hosts/queries";
import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import { getEventDetail } from "@/lib/events/queries";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";
import { loadAvailabilitySaveContext } from "@/lib/scheduling/availability-save-context";
import { schedulePushDelivery } from "@/lib/push/schedule";
import { devTimed } from "@/lib/perf/dev-server-timing";
import {
  confirmedDuringSaveToast,
  isSchedulingClosedDbError,
  resolveConfirmRaceAfterFailedSave,
  shouldRetryAvailabilitySaveAfterConfirmRace,
} from "@/domain/scheduling/confirm-during-save";
import {
  getServerAuthUserFromSession,
  getServerSupabase,
} from "@/lib/auth/server-session";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { upsertMemberAvailability } from "@/lib/scheduling/upsert-member-availability";

import type { EventActionState } from "./actions";

async function recoverAvailabilityAfterConfirmRace(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    groupId: string;
    userId: string;
    originalCandidateId: string;
    dbResponse: string;
    hasNoteField: boolean;
    privateNote: string | null;
    timeZone: string;
  },
): Promise<EventActionState | null> {
  const detailAfter = await getEventDetail(supabase, input.eventId, input.userId);
  if (!detailAfter || detailAfter.status !== "confirmed") {
    return null;
  }

  const { data: selected } = await supabase
    .from("event_candidates")
    .select("id, starts_at, ends_at, status")
    .eq("event_id", input.eventId)
    .eq("group_id", input.groupId)
    .eq("status", "selected")
    .maybeSingle();

  const selectedPayload =
    selected?.id && selected.starts_at
      ? {
          id: selected.id,
          startsAt: selected.starts_at,
          endsAt: selected.ends_at,
        }
      : null;

  let retrySucceeded = false;
  if (
    selectedPayload &&
    shouldRetryAvailabilitySaveAfterConfirmRace(
      input.originalCandidateId,
      selectedPayload.id,
    )
  ) {
    const { error } = await upsertMemberAvailability(supabase, {
      candidateId: input.originalCandidateId,
      userId: input.userId,
      dbResponse: input.dbResponse,
      hasNoteField: input.hasNoteField,
      privateNote: input.privateNote,
    });
    retrySucceeded = !error;
  }

  return resolveConfirmRaceAfterFailedSave({
    originalCandidateId: input.originalCandidateId,
    selected: selectedPayload,
    timeZone: input.timeZone,
    retrySucceeded,
  });
}

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
  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail || detail.groupId !== groupId) {
    return { error: "Event not found." };
  }

  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group) {
    return { error: "You do not have access to this group." };
  }

  const timeZone = group.settings.timezone;
  const startsAt = parseRequiredDateTime(
    String(formData.get("starts_at") ?? ""),
    timeZone,
  );
  // End is optional: blank means a start-only time. A non-blank value must still parse.
  const endsAtRaw = String(formData.get("ends_at") ?? "");
  const endsAt =
    endsAtRaw.trim().length === 0 ? null : parseRequiredDateTime(endsAtRaw, timeZone);

  if (!eventId || !groupId || !startsAt) {
    return { error: "Enter a valid start time." };
  }
  if (endsAtRaw.trim().length > 0 && !endsAt) {
    return { error: "Enter a valid end time, or leave it blank." };
  }

  const windowError = validateCandidateWindow(startsAt, endsAt);
  if (windowError) {
    return { error: windowError };
  }

  const pastError = validateCandidateStartNotPast(startsAt, new Date().toISOString());
  if (pastError) {
    return { error: pastError };
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
  revalidatePath(`/events/${eventId}/respond`);
  schedulePushDelivery();
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
  schedulePushDelivery();
  return { message: "Candidate removed." };
}

/** Refresh home / Your hui / group event lists after attendance saves (debounce on the client). */
export async function revalidateHomeGatheringSurfacesAction(
  groupId?: string,
): Promise<void> {
  revalidatePath("/dashboard");
  revalidatePath("/events");
  if (groupId) {
    revalidatePath(`/groups/${groupId}/events`);
  }
}

async function confirmSnapshotAfterAvailabilitySave(
  supabase: SupabaseClient,
  input: { eventId: string; groupId: string; timeZone: string },
): Promise<EventActionState | null> {
  const { data: statusRow, error: statusError } = await supabase
    .from("events")
    .select("status")
    .eq("id", input.eventId)
    .maybeSingle();
  if (statusError) {
    return { error: statusError.message };
  }
  if (statusRow?.status !== "confirmed") {
    return null;
  }

  const { data: selected } = await supabase
    .from("event_candidates")
    .select("id, starts_at, ends_at")
    .eq("event_id", input.eventId)
    .eq("group_id", input.groupId)
    .eq("status", "selected")
    .maybeSingle();

  if (!selected?.id || !selected.starts_at) {
    return null;
  }

  return {
    message: "Response saved.",
    notice: confirmedDuringSaveToast(selected.starts_at, selected.ends_at, input.timeZone),
    confirmedCandidate: {
      id: selected.id,
      startsAt: selected.starts_at,
      endsAt: selected.ends_at,
    },
  };
}

/** Off the save hot path: detect auto-confirm after a fast availability upsert. */
export async function fetchConfirmAfterAvailabilitySaveAction(
  eventId: string,
  groupId: string,
  timeZone: string,
): Promise<EventActionState | null> {
  const user = await getServerAuthUserFromSession();
  if (!user) {
    redirect("/sign-in");
  }
  const supabase = await getServerSupabase();
  return confirmSnapshotAfterAvailabilitySave(supabase, { eventId, groupId, timeZone });
}

export async function setAvailabilityResponseAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  return devTimed("setAvailabilityResponseAction:total", async () => {
    const eventId = String(formData.get("event_id") ?? "");
    const candidateId = String(formData.get("candidate_id") ?? "");
    const choice = parseAvailabilityChoice(String(formData.get("response") ?? ""));

    if (!eventId || !candidateId || !choice) {
      return { error: "Choose a valid response." };
    }

    const [user, supabase] = await devTimed("setAvailabilityResponseAction:session", () =>
      Promise.all([getServerAuthUserFromSession(), getServerSupabase()]),
    );
    if (!user) {
      redirect("/sign-in");
    }

    const loaded = await devTimed("setAvailabilityResponseAction:context", () =>
      loadAvailabilitySaveContext(supabase, eventId, candidateId),
    );
    if (!loaded.ok) {
      return { error: loaded.error };
    }
    const { groupId, timeZone, maybeResponsesEnabled } = loaded.context;

    const maybeError = validateAvailabilityChoice(choice, maybeResponsesEnabled);
    if (maybeError) {
      return { error: maybeError };
    }

    // Only touch the private note when the caller sent one, so changing an answer from the event
    // page never wipes a note saved elsewhere.
    const hasNoteField = formData.has("private_note");
    const privateNoteRaw = String(formData.get("private_note") ?? "");
    const privateNote = normalizePrivateAttendanceNote(privateNoteRaw);
    if (privateNoteRaw.trim().length > 0 && privateNote === null) {
      return { error: "Reason is too long (500 characters max)." };
    }

    const dbResponse = availabilityToDbResponse(choice);
    const { error: upsertError } = await devTimed("setAvailabilityResponseAction:upsert", () =>
      upsertMemberAvailability(supabase, {
        candidateId,
        userId: user.id,
        dbResponse,
        hasNoteField,
        privateNote,
      }),
    );

    const scheduleRevalidateAfterAvailabilitySave = () => {
      after(() => {
        revalidatePath(`/events/${eventId}`);
      });
    };

    if (upsertError) {
      if (isSchedulingClosedDbError(upsertError)) {
        const recovered = await recoverAvailabilityAfterConfirmRace(supabase, {
          eventId,
          groupId,
          userId: user.id,
          originalCandidateId: candidateId,
          dbResponse,
          hasNoteField,
          privateNote,
          timeZone,
        });
        if (recovered) {
          schedulePushDelivery();
          return recovered;
        }
      }
      return { error: upsertError };
    }

    schedulePushDelivery();
    scheduleRevalidateAfterAvailabilitySave();

    return { message: "Response saved." };
  });
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

  const forceConfirm = String(formData.get("force_confirm") ?? "") === "1";

  const { error } = await supabase.rpc("finalise_event", {
    p_event_id: eventId,
    p_candidate_id: candidateId,
    p_force: forceConfirm,
  });

  if (error) {
    return { error: friendlyFinaliseErrorMessage(error.message) };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}/events`);
  schedulePushDelivery();
  return { message: "Event confirmed." };
}

export async function adminFinaliseEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const candidateId = String(formData.get("candidate_id") ?? "");

  if (!eventId || !candidateId) {
    return { error: "Choose a time." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  if (!canAdminPickEventTime(detail.status, detail.viewerRole)) {
    return { error: "Only group owners or admins can pick a different time." };
  }

  const { error } = await supabase.rpc("admin_finalise_event", {
    p_event_id: eventId,
    p_candidate_id: candidateId,
  });

  if (error) {
    return { error: friendlyFinaliseErrorMessage(error.message) };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath(`/groups/${detail.groupId}/events`);
  schedulePushDelivery();
  return { message: "Time confirmed." };
}

export async function updateEventResponseDeadlineAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const deadlineLocal = String(formData.get("response_deadline_at") ?? "").trim();

  if (!eventId) {
    return { error: "Event not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  if (!eventAcceptsResponseDeadline(detail.status)) {
    return { error: "This hui is no longer open for scheduling." };
  }

  const hostContext = await getEventHostContext(supabase, eventId, detail.groupId, user.id);
  const acceptedHostUserId =
    pickAcceptedHost(hostContext?.assignments ?? [])?.userId ?? null;

  if (
    !canEditEventResponseDeadline(
      detail.status,
      detail.viewerRole,
      user.id,
      detail.createdBy,
      acceptedHostUserId,
    )
  ) {
    return { error: "You cannot change the reply deadline." };
  }

  const timeZone = detail.timezone ?? "Pacific/Auckland";
  const deadlineAt = deadlineLocal ? wallClockToUtcIso(deadlineLocal, timeZone) : null;
  if (deadlineLocal && !deadlineAt) {
    return { error: "Enter a valid date and time." };
  }

  const { error } = await supabase.rpc("update_event_response_deadline", {
    p_event_id: eventId,
    p_deadline_at: deadlineAt,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath(`/events/${eventId}/respond`);
  return { message: deadlineAt ? "Reply deadline updated." : "Reply deadline cleared." };
}

export async function nudgeEventAvailabilityAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");

  if (!eventId) {
    return { error: "Event not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  const hostContext = await getEventHostContext(supabase, eventId, detail.groupId, user.id);
  const acceptedHostUserId =
    pickAcceptedHost(hostContext?.assignments ?? [])?.userId ?? null;

  if (
    !canNudgeEventAvailability(
      detail.status,
      detail.viewerRole,
      user.id,
      detail.createdBy,
      acceptedHostUserId,
    )
  ) {
    return { error: "You cannot nudge members for this hui." };
  }

  const { data, error } = await supabase.rpc("nudge_event_availability", {
    p_event_id: eventId,
  });

  if (error) {
    return { error: error.message };
  }

  const payload = data as {
    queued?: number;
    rate_limited?: boolean;
    next_nudge_at?: string;
  } | null;

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);

  if (payload?.rate_limited) {
    return {
      error: "You can nudge once every 24 hours for this hui.",
      notice: payload.next_nudge_at ?? undefined,
    };
  }

  const queued = payload?.queued ?? 0;
  schedulePushDelivery();
  return {
    message: formatAvailabilityNudgeSuccessMessage(queued),
  };
}

export async function updateEventConfirmRuleAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const ruleRaw = String(formData.get("confirm_rule") ?? "");

  if (!eventId || !ruleRaw) {
    return { error: "Choose how this hui should confirm." };
  }

  if (!isEventConfirmRule(ruleRaw)) {
    return { error: "Choose a valid confirmation rule." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  if (detail.status !== "proposing") {
    return { error: "Confirmation rules can only be changed while planning." };
  }

  if (
    !canFinaliseEvent(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot change the confirmation rule for this hui." };
  }

  const { error } = await supabase.rpc("update_event_confirm_rule", {
    p_event_id: eventId,
    p_confirm_rule: ruleRaw,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);
  return { message: "Confirmation rule updated." };
}
