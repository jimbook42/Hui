"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizeDietaryLabel,
  normalizeDietaryNotes,
  parseDietaryCategory,
  parseDietaryEntryId,
  parseGroupId,
} from "@/domain/dietary/validation";
import { createClient } from "@/lib/supabase/server";

export type DietaryActionState = {
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

function revalidateDietaryPaths(groupId?: string) {
  revalidatePath("/profile");
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/events`);
  }
}

export async function createDietaryEntryAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const label = normalizeDietaryLabel(String(formData.get("label") ?? ""));
  const notes = normalizeDietaryNotes(String(formData.get("notes") ?? ""));
  const category =
    parseDietaryCategory(String(formData.get("category") ?? "requirement")) ?? "requirement";

  if (!label) {
    return { error: "Enter a short label between 1 and 120 characters." };
  }
  if (formData.get("notes") && notes === null && String(formData.get("notes")).trim()) {
    return { error: "Optional detail must be between 1 and 500 characters." };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("dietary_entries").insert({
    user_id: user.id,
    category,
    label,
    notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths();
  return { message: "Dietary information added." };
}

export async function updateDietaryEntryAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const entryId = parseDietaryEntryId(String(formData.get("entry_id") ?? ""));
  const label = normalizeDietaryLabel(String(formData.get("label") ?? ""));
  const notes = normalizeDietaryNotes(String(formData.get("notes") ?? ""));
  const category =
    parseDietaryCategory(String(formData.get("category") ?? "requirement")) ?? "requirement";

  if (!entryId || !label) {
    return { error: "Enter a valid label to save." };
  }
  if (formData.get("notes") && notes === null && String(formData.get("notes")).trim()) {
    return { error: "Optional detail must be between 1 and 500 characters." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("dietary_entries")
    .update({ category, label, notes })
    .eq("id", entryId);

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths();
  return { message: "Dietary information updated." };
}

export async function deleteDietaryEntryAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const entryId = parseDietaryEntryId(String(formData.get("entry_id") ?? ""));
  if (!entryId) {
    return { error: "Could not remove dietary information." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("dietary_entries").delete().eq("id", entryId);

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths();
  return { message: "Dietary information removed." };
}

export async function shareDietaryEntryAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const entryId = parseDietaryEntryId(String(formData.get("entry_id") ?? ""));
  const groupId = parseGroupId(String(formData.get("group_id") ?? ""));
  if (!entryId || !groupId) {
    return { error: "Could not share dietary information with that group." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("dietary_entry_shares").insert({
    dietary_entry_id: entryId,
    group_id: groupId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths(groupId);
  return { message: "Shared with group." };
}

export async function unshareDietaryEntryAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const entryId = parseDietaryEntryId(String(formData.get("entry_id") ?? ""));
  const groupId = parseGroupId(String(formData.get("group_id") ?? ""));
  if (!entryId || !groupId) {
    return { error: "Could not stop sharing dietary information." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("dietary_entry_shares")
    .delete()
    .eq("dietary_entry_id", entryId)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths(groupId);
  return { message: "No longer shared with that group." };
}
