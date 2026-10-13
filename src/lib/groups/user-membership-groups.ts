import type { SupabaseClient } from "@supabase/supabase-js";

export type UserMembershipGroup = {
  groupId: string;
  groupName: string;
};

/** Active group memberships for the current user (id + name). */
export async function listActiveMembershipGroups(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserMembershipGroup[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select(
      `
      group_id,
      groups:group_id (
        id,
        name
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const options: UserMembershipGroup[] = [];
  for (const row of data ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (group) {
      options.push({ groupId: group.id, groupName: group.name });
    }
  }

  options.sort((a, b) => a.groupName.localeCompare(b.groupName));
  return options;
}
