"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAssignEventContributions,
  canCoordinateContributions,
  canManageContributionCategories,
} from "@/domain/contributions/permissions";
import {
  normalizeCategoryName,
  normalizeContributionDescription,
  normalizeContributionLabelUpdate,
} from "@/domain/contributions/validation";
import { getEventDetail } from "@/lib/events/queries";
import { getGroupDetail } from "@/lib/groups/queries";
import { schedulePushDelivery } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

export type ContributionActionState = {
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

export async function createContributionCategoryAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const name = normalizeCategoryName(String(formData.get("name") ?? ""));
  if (!groupId || !name) {
    return { error: "Enter a category name between 1 and 60 characters." };
  }

  const { supabase, user } = await requireUser();
  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group || !canManageContributionCategories(group.viewerRole)) {
    return { error: "You cannot manage contribution categories for this group." };
  }

  const { error } = await supabase.from("contribution_categories").insert({
    group_id: groupId,
    name,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Category added." };
}

export async function updateContributionCategoryRulesAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!groupId || !categoryId) {
    return { error: "Category not found." };
  }

  const { supabase, user } = await requireUser();
  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group || !canManageContributionCategories(group.viewerRole)) {
    return { error: "You cannot manage contribution categories for this group." };
  }

  const { error } = await supabase
    .from("contribution_categories")
    .update({ follows_host: formData.get("follows_host") === "on" })
    .eq("id", categoryId)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Category rules saved." };
}

export async function renameContributionCategoryAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const name = normalizeCategoryName(String(formData.get("name") ?? ""));
  if (!groupId || !categoryId || !name) {
    return { error: "Enter a valid category name." };
  }

  const { supabase, user } = await requireUser();
  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group || !canManageContributionCategories(group.viewerRole)) {
    return { error: "You cannot manage contribution categories for this group." };
  }

  const { error } = await supabase
    .from("contribution_categories")
    .update({ name })
    .eq("id", categoryId)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Category renamed." };
}

export async function deactivateContributionCategoryAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!groupId || !categoryId) {
    return { error: "Category not found." };
  }

  const { supabase, user } = await requireUser();
  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group || !canManageContributionCategories(group.viewerRole)) {
    return { error: "You cannot manage contribution categories for this group." };
  }

  const { error } = await supabase
    .from("contribution_categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("group_id", groupId)
    .is("archived_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Category deactivated." };
}

export async function claimContributionAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const categoryName = String(formData.get("category_name") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "");

  if (!eventId || !groupId || !categoryId) {
    return { error: "Choose a category to claim." };
  }

  const label = normalizeContributionDescription(descriptionRaw, categoryName);
  if (!label) {
    return { error: "Description must be between 1 and 160 characters when provided." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail || detail.groupId !== groupId) {
    return { error: "Event not found." };
  }
  if (!canCoordinateContributions(detail.status)) {
    return { error: "Contributions are closed for this event." };
  }

  const { error } = await supabase.rpc("claim_event_contribution", {
    p_event_id: eventId,
    p_category_id: categoryId,
    p_description: descriptionRaw.trim() === "" ? null : descriptionRaw.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Contribution claimed." };
}

export async function updateContributionAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const contributionId = String(formData.get("contribution_id") ?? "");
  const label = normalizeContributionLabelUpdate(String(formData.get("description") ?? ""));
  if (!eventId || !contributionId || !label) {
    return { error: "Enter a description between 1 and 160 characters." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }
  if (!canCoordinateContributions(detail.status)) {
    return { error: "Contributions are closed for this event." };
  }

  const { error } = await supabase.rpc("update_my_event_contribution", {
    p_contribution_id: contributionId,
    p_description: label,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Contribution updated." };
}

export async function releaseContributionAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const contributionId = String(formData.get("contribution_id") ?? "");
  if (!eventId || !contributionId) {
    return { error: "Contribution not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return { error: "Event not found." };
  }
  if (!canCoordinateContributions(detail.status)) {
    return { error: "Contributions are closed for this event." };
  }

  const { error } = await supabase.rpc("release_event_contribution", {
    p_contribution_id: contributionId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Contribution released." };
}

export async function setContributionCategoryDefaultAssigneeAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const assigneeRaw = String(formData.get("default_assignee_user_id") ?? "");

  if (!groupId || !categoryId) {
    return { error: "Category not found." };
  }

  const defaultAssigneeUserId = assigneeRaw === "" ? null : assigneeRaw;

  const { supabase, user } = await requireUser();
  const group = await getGroupDetail(supabase, groupId, user.id);
  if (!group || !canManageContributionCategories(group.viewerRole)) {
    return { error: "You cannot manage contribution categories for this group." };
  }

  if (defaultAssigneeUserId !== null) {
    const isMember = group.members.some((member) => member.userId === defaultAssigneeUserId);
    if (!isMember) {
      return { error: "Choose an active group member." };
    }
  }

  const { error } = await supabase
    .from("contribution_categories")
    .update({ default_assignee_user_id: defaultAssigneeUserId })
    .eq("id", categoryId)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/groups/${groupId}`);
  schedulePushDelivery();
  return { message: "Standing preference saved." };
}

async function assertCanAssignContributions(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  eventId: string,
) {
  const detail = await getEventDetail(supabase, eventId, userId);
  if (!detail) {
    return { error: "Event not found." as const, detail: null };
  }
  if (!canAssignEventContributions(detail.viewerRole, userId, detail.createdBy, detail.status)) {
    return { error: "You cannot assign contributions for this event." as const, detail: null };
  }
  if (!canCoordinateContributions(detail.status)) {
    return { error: "Contributions are closed for this event." as const, detail: null };
  }
  return { error: null, detail };
}

export async function assignContributionAsManagerAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const memberUserId = String(formData.get("member_user_id") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "");

  if (!eventId || !groupId || !categoryId || !memberUserId) {
    return { error: "Choose a member and category." };
  }

  const { supabase, user } = await requireUser();
  const gate = await assertCanAssignContributions(supabase, user.id, eventId);
  if (gate.error || !gate.detail || gate.detail.groupId !== groupId) {
    return { error: gate.error ?? "Event not found." };
  }

  const { error } = await supabase.rpc("assign_event_contribution_as_manager", {
    p_event_id: eventId,
    p_category_id: categoryId,
    p_member_user_id: memberUserId,
    p_description: descriptionRaw.trim() === "" ? null : descriptionRaw.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Contribution assigned." };
}

export async function reassignContributionAsManagerAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const contributionId = String(formData.get("contribution_id") ?? "");
  const memberUserId = String(formData.get("member_user_id") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "");

  if (!eventId || !contributionId || !memberUserId) {
    return { error: "Choose a member to assign." };
  }

  const { supabase, user } = await requireUser();
  const gate = await assertCanAssignContributions(supabase, user.id, eventId);
  if (gate.error) {
    return { error: gate.error };
  }

  const { error } = await supabase.rpc("reassign_event_contribution_as_manager", {
    p_contribution_id: contributionId,
    p_member_user_id: memberUserId,
    p_description: descriptionRaw.trim() === "" ? null : descriptionRaw.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Contribution reassigned." };
}

export async function releaseContributionAsManagerAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const contributionId = String(formData.get("contribution_id") ?? "");

  if (!eventId || !contributionId) {
    return { error: "Contribution not found." };
  }

  const { supabase, user } = await requireUser();
  const gate = await assertCanAssignContributions(supabase, user.id, eventId);
  if (gate.error) {
    return { error: gate.error };
  }

  const { error } = await supabase.rpc("release_event_contribution_as_manager", {
    p_contribution_id: contributionId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/respond`);
  revalidatePath(`/events/${eventId}/manage`);
  schedulePushDelivery();
  return { message: "Assignment cleared." };
}
