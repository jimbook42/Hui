"use server";

import { revalidatePath } from "next/cache";

import { parseRecurrenceCadenceInput } from "@/domain/recurrence/recurrence-cadence-validation";
import { canEditSettings } from "@/domain/groups/permissions";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { syncGroupPlanningAfterChange } from "@/lib/groups/sync-planning-after-change";

export type PlanningCycleActionState = {
  error?: string;
  message?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." as const, supabase: null, user: null };
  }
  return { supabase, user, error: null };
}

export async function setRecurrencePausedAction(
  _prev: PlanningCycleActionState,
  formData: FormData,
): Promise<PlanningCycleActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const paused = formData.get("paused") === "1";
  if (!groupId) {
    return { error: "Missing group." };
  }

  const session = await requireUser();
  if (session.error || !session.supabase || !session.user) {
    return { error: session.error ?? "You must be signed in." };
  }
  const { supabase, user } = session;
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "Group not found." };
  }
  if (!canEditSettings(detail.viewerRole)) {
    return { error: "Only a group admin can pause recurrence." };
  }

  const { error } = await supabase.rpc("set_group_recurrence_paused", {
    p_group_id: groupId,
    p_paused: paused,
  });
  if (error) {
    return { error: error.message };
  }

  await syncGroupPlanningAfterChange(supabase, groupId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/events/new`);
  revalidatePath("/dashboard");
  return { message: paused ? "Recurrence paused." : "Recurrence resumed." };
}

export async function skipPlanningCycleAction(
  _prev: PlanningCycleActionState,
  formData: FormData,
): Promise<PlanningCycleActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const nominalDate = String(formData.get("nominal_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!groupId || !nominalDate) {
    return { error: "Enter the nominal date to skip." };
  }

  const session = await requireUser();
  if (session.error || !session.supabase || !session.user) {
    return { error: session.error ?? "You must be signed in." };
  }
  const { supabase, user } = session;
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "Group not found." };
  }
  if (!canEditSettings(detail.viewerRole)) {
    return { error: "Only a group admin can skip a cycle." };
  }

  const { error } = await supabase.rpc("skip_group_planning_cycle", {
    p_group_id: groupId,
    p_nominal_date: nominalDate,
    p_reason: reason || null,
  });
  if (error) {
    return { error: error.message };
  }

  await syncGroupPlanningAfterChange(supabase, groupId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/events/new`);
  revalidatePath("/dashboard");
  return { message: "Planning cycle skipped." };
}

export async function updateGroupRecurrenceCadenceAction(
  _prev: PlanningCycleActionState,
  formData: FormData,
): Promise<PlanningCycleActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const intervalUnit = String(formData.get("interval_unit") ?? "");
  const intervalCount = Number(formData.get("interval_count"));
  const anchorDate = String(formData.get("anchor_date") ?? "").trim();

  if (!groupId) {
    return { error: "Missing group." };
  }

  const parsed = parseRecurrenceCadenceInput({
    intervalUnit,
    intervalCount,
    anchorDate,
  });
  if (parsed.error || !parsed.cadence) {
    return { error: parsed.error ?? "Invalid cadence." };
  }

  const session = await requireUser();
  if (session.error || !session.supabase || !session.user) {
    return { error: session.error ?? "You must be signed in." };
  }
  const { supabase, user } = session;
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "Group not found." };
  }
  if (!canEditSettings(detail.viewerRole)) {
    return { error: "Only a group admin can edit recurrence." };
  }
  if (!detail.settings.recurringEventsEnabled) {
    return { error: "Recurring events are not enabled for this group." };
  }

  const { error } = await supabase.rpc("update_group_recurrence_cadence", {
    p_group_id: groupId,
    p_interval_unit: parsed.cadence.intervalUnit,
    p_interval_count: parsed.cadence.intervalCount,
    p_anchor_date: parsed.cadence.anchorDate,
  });
  if (error) {
    return { error: error.message };
  }

  await syncGroupPlanningAfterChange(supabase, groupId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/events/new`);
  revalidatePath("/dashboard");
  return { message: "Recurrence cadence saved." };
}
