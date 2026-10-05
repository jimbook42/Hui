"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type EventProposalDraft,
  validateEventProposalDraft,
} from "@/domain/events/proposal";
import { roundCoordinate } from "@/domain/events/location";
import { canProposeEvents, groupAllowsEventKind } from "@/domain/events/permissions";
import { parseEventKind } from "@/domain/events/validation";
import { getGroupDetail } from "@/lib/groups/queries";
import { schedulePushDelivery } from "@/lib/push/schedule";
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

export async function proposeGroupEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const draftRaw = String(formData.get("proposal_draft") ?? "");

  if (!groupId || !draftRaw) {
    return { error: "Missing proposal data." };
  }

  let draft: EventProposalDraft;
  try {
    draft = JSON.parse(draftRaw) as EventProposalDraft;
  } catch {
    return { error: "Proposal data is invalid." };
  }

  const kind = parseEventKind(draft.eventKind);
  if (!kind) {
    return { error: "Choose a valid event type." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "You do not have access to this group." };
  }

  if (!canProposeEvents(detail.viewerRole, detail.settings)) {
    return { error: "You cannot propose events in this group." };
  }
  if (!groupAllowsEventKind(kind, detail.settings)) {
    return {
      error:
        kind === "one_off"
          ? "One-off events are not allowed in this group."
          : "Recurring events are not allowed in this group.",
    };
  }

  const { count: activeEventCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .neq("status", "cancelled");

  const isFirstGroupEvent = (activeEventCount ?? 0) === 0;
  const validation = validateEventProposalDraft(draft, {
    timeZone: detail.settings.timezone,
    isFirstGroupEvent,
    hostingEnabled: detail.settings.hostingEnabled,
    memberUserIds: detail.members.map((member) => member.userId),
    groupName: detail.name,
  });

  if (!validation.ok) {
    return { error: validation.error };
  }

  const { payload } = validation;

  const { data: eventId, error } = await supabase.rpc("propose_group_event", {
    p_group_id: groupId,
    p_title: payload.title,
    p_location: payload.location,
    p_notes: payload.notes,
    p_recurrence: payload.recurrence,
    p_candidates: payload.candidates,
    p_set_initial_host: payload.setInitialHost,
    p_initial_host_user_id: payload.initialHostUserId,
    p_location_lat: payload.locationCoordinates
      ? roundCoordinate(payload.locationCoordinates.lat)
      : null,
    p_location_lng: payload.locationCoordinates
      ? roundCoordinate(payload.locationCoordinates.lng)
      : null,
    p_gathering_type: payload.gatheringType,
    p_gathering_type_custom: payload.gatheringTypeCustom,
  });

  if (error) {
    return { error: error.message };
  }
  if (!eventId || typeof eventId !== "string") {
    return { error: "Proposal could not be created. Try again." };
  }

  if (payload.foodInvolvement || detail.settings.hostingEnabled) {
    const { error: metaError } = await supabase
      .from("events")
      .update({
        ...(payload.foodInvolvement ? { food_involvement: payload.foodInvolvement } : {}),
        ...(detail.settings.hostingEnabled
          ? { host_place_required: payload.hostPlaceRequired }
          : {}),
      })
      .eq("id", eventId)
      .eq("group_id", groupId);
    if (metaError) {
      return { error: metaError.message };
    }
  }

  const { data: created, error: verifyError } = await supabase
    .from("events")
    .select("id, status, starts_at, ends_at")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (verifyError || !created) {
    return { error: "Proposal was not saved correctly." };
  }
  if (created.status !== "proposing" || created.starts_at !== null || created.ends_at !== null) {
    return { error: "Proposal timing state is invalid." };
  }

  const { count: candidateCount } = await supabase
    .from("event_candidates")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "proposed");

  if ((candidateCount ?? 0) < 1) {
    return { error: "Proposal is missing candidate times." };
  }

  revalidatePath(`/groups/${groupId}/events`);
  schedulePushDelivery();
  redirect(`/events/${eventId}?proposed=1`);
}
