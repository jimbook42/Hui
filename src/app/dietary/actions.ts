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
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

export type DietaryActionState = {
  error?: string;
  message?: string;
};

async function requireUser() {
  const user = await devTimed("dietary-action:getUser", () => getServerAuthUser());
  if (!user) {
    redirect("/sign-in");
  }
  const supabase = await getServerSupabase();
  return { supabase, user };
}

function revalidateDietaryPaths(groupId?: string) {
  revalidatePath("/profile");
  revalidatePath("/profile/dietary");
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

/**
 * Turn "share with all my groups" on or off for one entry. Off by default and never inferred:
 * only an explicit request from the owner changes it. Existing group-specific shares are left
 * exactly as they were in both directions, so turning it off returns the entry to its
 * group-only state. The database (RLS) only lets the owner update their own entry.
 */
export async function setDietaryShareAllGroupsAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const entryId = parseDietaryEntryId(String(formData.get("entry_id") ?? ""));
  const enabledRaw = String(formData.get("enabled") ?? "");
  if (!entryId || (enabledRaw !== "true" && enabledRaw !== "false")) {
    return { error: "Could not change sharing for that entry." };
  }
  const enabled = enabledRaw === "true";

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("dietary_entries")
    .update({ share_with_all_groups: enabled })
    .eq("id", entryId)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Could not change sharing for that entry." };
  }

  revalidateDietaryPaths();
  // Group and event pages read this setting, so refresh them wherever they are cached.
  revalidatePath("/groups/[groupId]", "page");
  revalidatePath("/events/[eventId]", "page");
  return {
    message: enabled ? "Shared with all your groups." : "No longer shared with all your groups.",
  };
}

async function listOwnedEntryIds(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  const { data, error } = await supabase.from("dietary_entries").select("id").eq("user_id", userId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, ids: (data ?? []).map((row) => row.id as string) };
}

/** Scope control: share or stop sharing all entries with every group. */
export async function setDietaryGlobalShareAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const enabledRaw = String(formData.get("enabled") ?? "");
  if (enabledRaw !== "true" && enabledRaw !== "false") {
    return { error: "Could not change sharing." };
  }
  const enabled = enabledRaw === "true";
  const { supabase, user } = await requireUser();
  const entries = await listOwnedEntryIds(supabase, user.id);
  if (!entries.ok) {
    return { error: entries.error };
  }
  if (entries.ids.length === 0) {
    return { error: "Add dietary information before changing sharing." };
  }

  const { error } = await supabase
    .from("dietary_entries")
    .update({ share_with_all_groups: enabled })
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDietaryPaths();
  revalidatePath("/groups/[groupId]", "page");
  revalidatePath("/events/[eventId]", "page");
  return {
    message: enabled
      ? "All your dietary information is shared with every group you are in."
      : "Stopped sharing all dietary information with every group.",
  };
}

/** Scope control: share or stop sharing all entries with one group. */
export async function setDietaryGroupShareAction(
  _prev: DietaryActionState,
  formData: FormData,
): Promise<DietaryActionState> {
  const groupId = parseGroupId(String(formData.get("group_id") ?? ""));
  const enabledRaw = String(formData.get("enabled") ?? "");
  if (!groupId || (enabledRaw !== "true" && enabledRaw !== "false")) {
    return { error: "Could not change sharing for that group." };
  }
  const enabled = enabledRaw === "true";
  const { supabase, user } = await requireUser();
  const entries = await listOwnedEntryIds(supabase, user.id);
  if (!entries.ok) {
    return { error: entries.error };
  }
  if (entries.ids.length === 0) {
    return { error: "Add dietary information before changing sharing." };
  }

  if (enabled) {
    for (const entryId of entries.ids) {
      const { error } = await supabase.from("dietary_entry_shares").insert({
        dietary_entry_id: entryId,
        group_id: groupId,
      });
      if (error && error.code !== "23505") {
        return { error: error.message };
      }
    }
  } else {
    const { error } = await supabase
      .from("dietary_entry_shares")
      .delete()
      .eq("group_id", groupId)
      .in("dietary_entry_id", entries.ids);
    if (error) {
      return { error: error.message };
    }
  }

  revalidateDietaryPaths(groupId);
  revalidatePath("/groups/[groupId]", "page");
  revalidatePath("/events/[eventId]", "page");
  return {
    message: enabled
      ? "All your dietary information is shared with that group."
      : "Stopped sharing your dietary information with that group.",
  };
}
