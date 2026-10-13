import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupPreview = {
  memberCount: number;
  members: { userId: string; name: string }[];
};

/** Member names for the groups a viewer belongs to (RLS decides who is visible). */
export async function listGroupPreviews(
  supabase: SupabaseClient,
  groupIds: string[],
): Promise<Map<string, GroupPreview>> {
  const previews = new Map<string, GroupPreview>();
  if (groupIds.length === 0) {
    return previews;
  }

  const { data, error } = await supabase
    .from("group_memberships")
    .select("group_id, user_id, profiles:user_id ( display_name )")
    .in("group_id", groupIds)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const raw = row.profiles as { display_name: string } | { display_name: string }[] | null;
    const profile = Array.isArray(raw) ? raw[0] : raw;
    const groupId = row.group_id as string;
    const preview = previews.get(groupId) ?? { memberCount: 0, members: [] };
    preview.memberCount += 1;
    preview.members.push({ userId: row.user_id as string, name: profile?.display_name ?? "Member" });
    previews.set(groupId, preview);
  }

  return previews;
}
