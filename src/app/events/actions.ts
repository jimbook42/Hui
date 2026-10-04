"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  INITIAL_EVENT_STATUS,
  canChangeEventSchedule,
  cancellationPatch,
  validateMetadataUpdate,
} from "@/domain/events/lifecycle";
import {
  canCancelEvent,
  canEditEventMetadata,
  canProposeEvents,
  groupAllowsEventKind,
} from "@/domain/events/permissions";
import { parseOptionalCoordinates } from "@/domain/events/location";
import {
  normalizeEventLocation,
  normalizeEventNotes,
  normalizeEventTitle,
  parseCadenceUnit,
  parseEventKind,
  parseIntervalCount,
  parseOptionalDateTime,
  parseStartsOnDate,
} from "@/domain/events/validation";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventDetail } from "@/lib/events/queries";
import { schedulePushDelivery } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

export type EventActionState = {
  error?: string;
  message?: string;
};

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

export async function createEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const title = normalizeEventTitle(String(formData.get("title") ?? ""));
  const kind = parseEventKind(String(formData.get("event_kind") ?? ""));
  const location = normalizeEventLocation(String(formData.get("location") ?? ""));
  const notes = normalizeEventNotes(String(formData.get("notes") ?? ""));
  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "You do not have access to this group." };
  }

  const timeZone = detail.settings.timezone;
  const startsAt = parseOptionalDateTime(String(formData.get("starts_at") ?? ""), timeZone);
  const endsAt = parseOptionalDateTime(String(formData.get("ends_at") ?? ""), timeZone);

  if (!groupId || !title || !kind) {
    return { error: "Enter a valid event title and type." };
  }
  if (location === null && String(formData.get("location") ?? "").trim().length > 0) {
    return { error: "Location is too long." };
  }
  if (notes === null && String(formData.get("notes") ?? "").trim().length > 0) {
    return { error: "Notes are too long." };
  }
  if (startsAt === null && String(formData.get("starts_at") ?? "").trim().length > 0) {
    return { error: "Start time is invalid." };
  }
  if (endsAt === null && String(formData.get("ends_at") ?? "").trim().length > 0) {
    return { error: "End time is invalid." };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "End time must be after start time." };
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

  let recurrenceSeriesId: string | null = null;
  if (kind === "recurring") {
    const seriesTitle = normalizeEventTitle(
      String(formData.get("series_title") ?? formData.get("title") ?? ""),
    );
    const intervalUnit = parseCadenceUnit(String(formData.get("interval_unit") ?? ""));
    const intervalCount = parseIntervalCount(String(formData.get("interval_count") ?? ""));
    const startsOn = parseStartsOnDate(String(formData.get("series_starts_on") ?? ""));
    if (!seriesTitle || !intervalUnit || intervalCount === null || !startsOn) {
      return { error: "Enter valid recurrence settings." };
    }

    const { data: series, error: seriesError } = await supabase
      .from("recurrence_series")
      .insert({
        group_id: groupId,
        title: seriesTitle,
        interval_unit: intervalUnit,
        interval_count: intervalCount,
        starts_on: startsOn,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (seriesError) {
      return { error: seriesError.message };
    }
    recurrenceSeriesId = series.id;
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      group_id: groupId,
      recurrence_series_id: recurrenceSeriesId,
      title,
      status: INITIAL_EVENT_STATUS,
      location,
      notes,
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const initialHostRaw = String(formData.get("initial_host_user_id") ?? "").trim();
  if (initialHostRaw.length > 0 && detail.settings.hostingEnabled) {
    const { count: activeEventCount } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .neq("status", "cancelled");

    if ((activeEventCount ?? 0) === 1) {
      const hostUserId = initialHostRaw === "__none__" ? null : initialHostRaw;
      if (hostUserId !== null && !detail.members.some((m) => m.userId === hostUserId)) {
        return { error: "Choose a valid group member to host." };
      }

      const { error: hostError } = await supabase.rpc("propose_creator_initial_host_for_event", {
        p_event_id: event.id,
        p_host_user_id: hostUserId,
      });

      if (hostError) {
        return { error: hostError.message };
      }
    }
  }

  revalidatePath(`/groups/${groupId}/events`);
  schedulePushDelivery();
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const title = normalizeEventTitle(String(formData.get("title") ?? ""));
  const location = normalizeEventLocation(String(formData.get("location") ?? ""));
  const notes = normalizeEventNotes(String(formData.get("notes") ?? ""));
  const { supabase, user } = await requireUser();
  const existing = await getEventDetail(supabase, eventId, user.id);
  if (!existing) {
    return { error: "Event not found." };
  }
  const group = await getGroupDetail(supabase, existing.groupId, user.id);
  const timeZone = group?.settings.timezone;
  const startsAt = parseOptionalDateTime(String(formData.get("starts_at") ?? ""), timeZone);
  const endsAt = parseOptionalDateTime(String(formData.get("ends_at") ?? ""), timeZone);

  if (!eventId || !title) {
    return { error: "Enter a valid title." };
  }
  if (location === null && String(formData.get("location") ?? "").trim().length > 0) {
    return { error: "Location is too long." };
  }
  if (notes === null && String(formData.get("notes") ?? "").trim().length > 0) {
    return { error: "Notes are too long." };
  }
  if (startsAt === null && String(formData.get("starts_at") ?? "").trim().length > 0) {
    return { error: "Start time is invalid." };
  }
  if (endsAt === null && String(formData.get("ends_at") ?? "").trim().length > 0) {
    return { error: "End time is invalid." };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "End time must be after start time." };
  }
  if (endsAt && !startsAt) {
    return { error: "Add a start time before an end time." };
  }

  // The pin is optional and only touched when the form sent it (so older forms never clear it).
  const hasCoordinateFields = formData.has("location_lat") || formData.has("location_lng");
  const coordinates = parseOptionalCoordinates(
    formData.get("location_lat"),
    formData.get("location_lng"),
  );
  if (!coordinates.ok) {
    return { error: coordinates.error };
  }

  if (
    !canEditEventMetadata(
      existing.viewerRole,
      user.id,
      existing.createdBy,
      existing.status,
    )
  ) {
    return { error: "You cannot edit this event." };
  }

  const statusError = validateMetadataUpdate(existing.status, existing.status);
  if (statusError) {
    return { error: statusError };
  }

  const patch: {
    title: string;
    location: string | null;
    notes: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  } = {
    title,
    location,
    notes,
  };
  if (hasCoordinateFields) {
    patch.location_lat = coordinates.coordinates?.lat ?? null;
    patch.location_lng = coordinates.coordinates?.lng ?? null;
  }
  if (canChangeEventSchedule(existing.status)) {
    patch.starts_at = startsAt;
    patch.ends_at = endsAt;
  }

  const { error } = await supabase.from("events").update(patch).eq("id", eventId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${existing.groupId}/events`);
  schedulePushDelivery();
  return { message: "Event updated." };
}

export async function cancelEventAction(
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
    !canCancelEvent(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot cancel this event." };
  }

  const patch = cancellationPatch();
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .eq("status", detail.status);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}/events`);
  schedulePushDelivery();
  return { message: "Event cancelled." };
}
