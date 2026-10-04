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
    });
  }

  return entries;
}

export async function listGroupSharedDietary(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupSharedDietaryRow[]> {
  const { data, error } = await supabase
    .from("dietary_entry_shares")
    .select(
      `
      dietary_entry_id,
      dietary_entries (
        id,
        user_id,
        category,
        label,
        notes,
        profiles:user_id (
          display_name
        )
      )
    `,
    )
    .eq("group_id", groupId);

  if (error) {
    throw new Error(error.message);
  }

  const rows: GroupSharedDietaryRow[] = [];
  for (const share of data ?? []) {
    const raw = share.dietary_entries as
      | {
          id: string;
          user_id: string;
          category: DietaryCategory;
          label: string;
          notes: string | null;
          profiles: { display_name: string } | { display_name: string }[] | null;
        }
      | {
          id: string;
          user_id: string;
          category: DietaryCategory;
          label: string;
          notes: string | null;
          profiles: { display_name: string } | { display_name: string }[] | null;
        }[]
      | null;

    const entry = Array.isArray(raw) ? raw[0] : raw;
    if (!entry) {
      continue;
    }

    const profileRaw = entry.profiles;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    if (!profile) {
      continue;
    }

    rows.push({
      entryId: entry.id,
      userId: entry.user_id,
      displayName: profile.display_name,
      category: entry.category,
      label: entry.label,
      notes: entry.notes,
    });
  }

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
