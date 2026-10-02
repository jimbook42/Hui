"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canEditSettings,
  canManageMembers,
  canRenameGroup,
  canTransferOwnership,
} from "@/domain/groups/permissions";
import { normalizeGroupName, parseUserId } from "@/domain/groups/validation";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

export type GroupActionState = {
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

export async function createGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const name = normalizeGroupName(String(formData.get("name") ?? ""));
  if (!name) {
    return { error: "Group name must be between 1 and 120 characters." };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_group", { p_name: name });

  if (error) {
    return { error: error.message };
  }

  const groupId = data as string;
  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}

export async function updateGroupNameAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const name = normalizeGroupName(String(formData.get("name") ?? ""));
  if (!groupId || !name) {
    return { error: "Enter a valid group name." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canRenameGroup(detail.viewerRole)) {
    return { error: "You cannot rename this group." };
  }

  const { error } = await supabase.from("groups").update({ name }).eq("id", groupId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { message: "Group name updated." };
}

export async function updateGroupSettingsAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  if (!groupId) {
    return { error: "Missing group." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canEditSettings(detail.viewerRole)) {
    return { error: "You cannot edit settings for this group." };
  }

  const minimumAttendees = Number(formData.get("minimum_attendees"));
  const proposalDeadlineRaw = String(formData.get("proposal_deadline_hours") ?? "").trim();
  const reconnectDaysRaw = String(formData.get("reconnect_after_days") ?? "").trim();

  const payload = {
    who_may_propose: String(formData.get("who_may_propose") ?? "any_member"),
    one_off_events_allowed: formData.get("one_off_events_allowed") === "on",
    recurring_events_enabled: formData.get("recurring_events_enabled") === "on",
    maybe_responses_enabled: formData.get("maybe_responses_enabled") === "on",
    minimum_attendees: minimumAttendees,
    proposal_deadline_hours: proposalDeadlineRaw === "" ? null : Number(proposalDeadlineRaw),
    consensus_rule: String(formData.get("consensus_rule") ?? "required_participants"),
    admin_veto_enabled: formData.get("admin_veto_enabled") === "on",
    host_veto_enabled: formData.get("host_veto_enabled") === "on",
    hosting_enabled: formData.get("hosting_enabled") === "on",
    avoid_consecutive_hosts: formData.get("avoid_consecutive_hosts") === "on",
    timezone: String(formData.get("timezone") ?? "Pacific/Auckland").trim(),
    reconnect_reminders_enabled: formData.get("reconnect_reminders_enabled") === "on",
    reconnect_after_days: reconnectDaysRaw === "" ? null : Number(reconnectDaysRaw),
  };

  if (!Number.isFinite(minimumAttendees) || minimumAttendees < 1) {
    return { error: "Minimum attendees must be at least 1." };
  }
  if (
    payload.proposal_deadline_hours !== null &&
    (!Number.isFinite(payload.proposal_deadline_hours) ||
      payload.proposal_deadline_hours <= 0)
  ) {
    return { error: "Proposal deadline hours must be a positive number." };
  }
  if (
    !payload.one_off_events_allowed &&
    !payload.recurring_events_enabled
  ) {
    return { error: "Enable at least one event mode." };
  }
  if (payload.timezone.length < 1 || payload.timezone.length > 64) {
    return { error: "Enter a valid timezone for this group." };
  }
  if (
    payload.reconnect_reminders_enabled &&
    (payload.reconnect_after_days === null ||
      !Number.isFinite(payload.reconnect_after_days) ||
      payload.reconnect_after_days < 1)
  ) {
    return { error: "Reconnect reminders need a day count." };
  }

  const { error } = await supabase
    .from("group_settings")
    .update(payload)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  return { message: "Settings saved." };
}

export async function setMyHostingStandingAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const standing = String(formData.get("hosting_standing") ?? "default");
  if (!groupId) {
    return { error: "Missing group." };
  }
  if (standing !== "default" && standing !== "prefer_not" && standing !== "never") {
    return { error: "Choose a valid hosting preference." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "Group not found." };
  }

  const { error } = await supabase.rpc("set_my_hosting_standing", {
    p_group_id: groupId,
    p_standing: standing,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  return { message: "Hosting preference saved." };
}

export async function setMemberConsensusRequiredAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const required = String(formData.get("required") ?? "") === "on";
  if (!groupId || !userId) {
    return { error: "Missing member." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canManageMembers(detail.viewerRole)) {
    return { error: "You cannot update member settings." };
  }

  const { error } = await supabase.rpc("set_member_consensus_required", {
    p_group_id: groupId,
    p_user_id: userId,
    p_required: required,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  return { message: "Member updated." };
}

export async function addGroupMemberAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const userId = parseUserId(String(formData.get("user_id") ?? ""));
  if (!groupId || !userId) {
    return { error: "Enter a valid member user ID." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canManageMembers(detail.viewerRole)) {
    return { error: "You cannot add members to this group." };
  }
  if (userId === user.id) {
    return { error: "You are already in this group." };
  }

  const { data: existing } = await supabase
    .from("group_memberships")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.status === "active") {
    return { error: "That person is already an active member." };
  }

  if (existing?.status === "removed") {
    const { error } = await supabase
      .from("group_memberships")
      .update({ status: "active", role: "member" })
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("group_memberships").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
      status: "active",
    });
    if (error) {
      return {
        error:
          error.code === "23503"
            ? "No Hui account exists for that user ID."
            : error.message,
      };
    }
  }

  revalidatePath(`/groups/${groupId}`);
  return { message: "Member added." };
}

export async function removeGroupMemberAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!groupId || !userId) {
    return { error: "Missing member." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canManageMembers(detail.viewerRole)) {
    return { error: "You cannot remove members from this group." };
  }
  if (userId === detail.ownerId) {
    return { error: "Transfer ownership before removing the owner." };
  }

  const { error } = await supabase
    .from("group_memberships")
    .update({ status: "removed" })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  return { message: "Member removed." };
}

export async function transferOwnershipAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const newOwnerId = String(formData.get("new_owner_id") ?? "");
  if (!groupId || !newOwnerId) {
    return { error: "Choose a new owner." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canTransferOwnership(detail.viewerRole)) {
    return { error: "Only the owner can transfer ownership." };
  }

  const { error } = await supabase.rpc("transfer_group_ownership", {
    p_group_id: groupId,
    p_new_owner: newOwnerId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { message: "Ownership transferred." };
}

export async function leaveGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  if (!groupId) {
    return { error: "Missing group." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/groups");
  redirect("/groups");
}
