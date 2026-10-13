import type { SupabaseClient } from "@supabase/supabase-js";

import type { DietaryCategory } from "@/domain/dietary/validation";
import type { GroupSharedDietaryRow, UserDietaryEntry, UserGroupOption } from "@/lib/dietary/types";
import {
  listActiveMembershipGroups,
  type UserMembershipGroup,
} from "@/lib/groups/user-membership-groups";

export async function listUserGroupsForDietary(
  supabase: SupabaseClient,
  userId: string,
  preloadedGroups?: UserMembershipGroup[],
): Promise<UserGroupOption[]> {
  const groups = preloadedGroups ?? (await listActiveMembershipGroups(supabase, userId));
  return groups.map((group) => ({
    groupId: group.groupId,
    groupName: group.groupName,
  }));
}

export async function listUserDietaryEntries(
  supabase: SupabaseClient,
): Promise<UserDietaryEntry[]> {
  const { data, error } = await supabase
    .from("dietary_entries")
    .select(
      `
      id,
      category,
      label,
      notes,
      share_with_all_groups,
      dietary_entry_shares (
        group_id,
        groups:group_id (
          id,
          name
        )
      )
    `,
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const entries: UserDietaryEntry[] = [];
  for (const row of data ?? []) {
    const shares: UserDietaryEntry["shares"] = [];
    const shareRows = row.dietary_entry_shares as
      | {
          group_id: string;
          groups: { id: string; name: string } | { id: string; name: string }[] | null;
        }[]
      | null;

    for (const share of shareRows ?? []) {
      const raw = share.groups;
      const group = Array.isArray(raw) ? raw[0] : raw;
      if (group) {
        shares.push({ groupId: group.id, groupName: group.name });
      }
    }
    shares.sort((a, b) => a.groupName.localeCompare(b.groupName));

    entries.push({
      id: row.id as string,
      category: row.category as DietaryCategory,
      label: row.label as string,
      notes: (row.notes as string | null) ?? null,
      shares,
      shareWithAllGroups: row.share_with_all_groups === true,
    });
  }

  return entries;
}

/**
 * Dietary entries the caller may see for one group: entries explicitly shared with the group plus
 * entries whose owner chose "share with all my groups". Visibility is decided in the database
 * (RLS + `list_group_dietary`), never in the client.
 */
export async function listGroupSharedDietary(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupSharedDietaryRow[]> {
  const { data, error } = await supabase.rpc("list_group_dietary", { p_group_id: groupId });

  if (error) {
    throw new Error(error.message);
  }

  const rows: GroupSharedDietaryRow[] = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    entryId: row.entry_id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    category: row.category as DietaryCategory,
    label: row.label as string,
    notes: (row.notes as string | null) ?? null,
    scope: row.scope === "group" ? "group" : "all_groups",
  }));

  rows.sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) {
      return byName;
    }
    return a.label.localeCompare(b.label);
  });

  return rows;
}

export async function countGroupSharedDietary(
  supabase: SupabaseClient,
  groupId: string,
): Promise<number> {
  const rows = await listGroupSharedDietary(supabase, groupId);
  return rows.length;
}
