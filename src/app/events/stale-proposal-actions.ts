"use server";

import { revalidatePath } from "next/cache";

import { parseStartsOnDate } from "@/domain/events/validation";
import { getEventDetail } from "@/lib/events/queries";
import { syncGroupPlanningAfterChange } from "@/lib/groups/sync-planning-after-change";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

export async function rescheduleProposalNominalAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const nominalRaw = String(formData.get("nominal_date") ?? "").trim();
  const nominal = parseStartsOnDate(nominalRaw);

  if (!eventId || !nominal) {
    return { error: "Choose a valid date." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }
  if (detail.status !== "proposing") {
    return { error: "Only an open proposal can be rescheduled." };
  }
  if (
    detail.createdBy !== user.id &&
    detail.viewerRole !== "owner" &&
    detail.viewerRole !== "admin"
  ) {
    return { error: "You cannot reschedule this proposal." };
  }

  const { error } = await supabase.rpc("reschedule_proposing_event_nominal", {
    p_event_id: eventId,
    p_nominal_date: nominal,
  });

  if (error) {
    return { error: error.message };
  }

  await syncGroupPlanningAfterChange(supabase, detail.groupId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}`);
  return { message: "Planning date updated." };
}
