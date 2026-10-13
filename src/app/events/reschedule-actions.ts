"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canRescheduleConfirmedEvent } from "@/domain/events/permissions";
import { parseOptionalDateTime } from "@/domain/events/validation";
import { getEventDetail } from "@/lib/events/queries";
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

export async function rescheduleConfirmedToTimeAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const startsRaw = String(formData.get("starts_at") ?? "");
  const endsRaw = String(formData.get("ends_at") ?? "");

  if (!eventId) {
    return { error: "Missing event." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }
  if (
    !canRescheduleConfirmedEvent(
      detail.viewerRole,
      user.id,
      detail.createdBy,
      detail.status,
    )
  ) {
    return { error: "You cannot reschedule this hui." };
  }

  const timeZone = detail.timezone ?? "Pacific/Auckland";
  const startsAt = parseOptionalDateTime(startsRaw, timeZone);
  const endsAt = endsRaw.trim() ? parseOptionalDateTime(endsRaw, timeZone) : null;

  if (!startsAt) {
    return { error: "Enter a valid new start time." };
  }
  if (endsRaw.trim() && !endsAt) {
    return { error: "End time is invalid." };
  }
  if (endsAt && endsAt <= startsAt) {
    return { error: "End time must be after start." };
  }

  const { error } = await supabase.rpc("reschedule_confirmed_event_to_time", {
    p_event_id: eventId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath(`/groups/${detail.groupId}`);
  schedulePushDelivery();
  return { message: "Hui rescheduled. Everyone has been asked again." };
}

export async function reopenConfirmedEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");

  if (!eventId) {
    return { error: "Missing event." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }
  if (
    !canRescheduleConfirmedEvent(
      detail.viewerRole,
      user.id,
      detail.createdBy,
      detail.status,
    )
  ) {
    return { error: "You cannot reopen this hui." };
  }

  const { error } = await supabase.rpc("reopen_confirmed_event_for_proposing", {
    p_event_id: eventId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath(`/groups/${detail.groupId}`);
  schedulePushDelivery();
  return { message: "Hui reopened for new proposed times." };
}
