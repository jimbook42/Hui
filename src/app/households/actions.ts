"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeHouseholdName } from "@/domain/households/validation";
import { parseUserId } from "@/domain/groups/validation";
import { createClient } from "@/lib/supabase/server";

export type HouseholdActionState = {
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

export async function createHouseholdAction(
  _prev: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const name = normalizeHouseholdName(String(formData.get("name") ?? ""));
  if (!groupId || !name) {
    return { error: "Enter a household name between 1 and 80 characters." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_household", {
    p_group_id: groupId,
    p_name: name,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Household created." };
}

export async function updateHouseholdNameAction(
  _prev: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const householdId = String(formData.get("household_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const name = normalizeHouseholdName(String(formData.get("name") ?? ""));
  if (!householdId || !groupId || !name) {
    return { error: "Enter a valid household name." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_household_name", {
    p_household_id: householdId,
    p_name: name,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Household name updated." };
}

export async function addHouseholdMemberAction(
  _prev: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const householdId = String(formData.get("household_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const userId = parseUserId(String(formData.get("user_id") ?? ""));
  if (!householdId || !groupId || !userId) {
    return { error: "Enter a valid member user ID." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("add_household_member", {
    p_household_id: householdId,
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Household member added." };
}

export async function removeHouseholdMemberAction(
  _prev: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const householdId = String(formData.get("household_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!householdId || !groupId || !userId) {
    return { error: "Could not remove household member." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_household_member", {
    p_household_id: householdId,
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Household member removed." };
}
