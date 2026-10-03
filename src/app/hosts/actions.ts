"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAssignEventHost,
  canRequestHostSwap,
  canRespondToHostProposal,
} from "@/domain/hosts/permissions";
import { pickPendingHostProposal } from "@/domain/hosts/display";
import { getEventDetail } from "@/lib/events/queries";
import { getGroupDetail } from "@/lib/groups/queries";
import { listEventHostAssignments } from "@/lib/hosts/queries";
import { schedulePushDelivery } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

export type HostActionState = {
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

function normalizeUserId(raw: string): string | null {
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export async function assignEventHostAction(
  _prev: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const hostUserId = normalizeUserId(String(formData.get("host_user_id") ?? ""));

  if (!eventId || !groupId || !hostUserId) {
    return { error: "Choose a member to host." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail || detail.groupId !== groupId) {
    return { error: "Event not found." };
  }

  if (
    !canAssignEventHost(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot assign a host for this event." };
  }

  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group?.members.some((m) => m.userId === hostUserId)) {
    return { error: "That person is not an active group member." };
  }

  const { error } = await supabase.rpc("assign_event_host", {
    p_event_id: eventId,
    p_user_id: hostUserId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Host suggestion updated." };
}

export async function requestHostSwapAction(
  _prev: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) {
    return { error: "Event not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  const assignments = await listEventHostAssignments(supabase, eventId);
  if (!canRequestHostSwap(user.id, assignments, detail.status)) {
    return { error: "You cannot request a swap for this event." };
  }

  const { error } = await supabase.rpc("request_host_swap", {
    p_event_id: eventId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}`);
  schedulePushDelivery();
  return { message: "Hui will suggest another host." };
}

export async function acceptHostProposalAction(
  _prev: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) {
    return { error: "Event not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  const assignments = await listEventHostAssignments(supabase, eventId);
  const pending = pickPendingHostProposal(assignments);
  if (!canRespondToHostProposal(user.id, pending, detail.status)) {
    return { error: "You cannot respond to this host proposal." };
  }

  const { error } = await supabase.rpc("respond_to_host_assignment", {
    p_event_id: eventId,
    p_accept: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/groups/${detail.groupId}`);
  schedulePushDelivery();
  return { message: "Thanks — you are down to host this gathering." };
}

export async function declineHostProposalAction(
  _prev: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) {
    return { error: "Event not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }

  const assignments = await listEventHostAssignments(supabase, eventId);
  const pending = pickPendingHostProposal(assignments);
  if (!canRespondToHostProposal(user.id, pending, detail.status)) {
    return { error: "You cannot respond to this host proposal." };
  }

  const { error } = await supabase.rpc("respond_to_host_assignment", {
    p_event_id: eventId,
    p_accept: false,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  schedulePushDelivery();
  return { message: "Host proposal declined." };
}

