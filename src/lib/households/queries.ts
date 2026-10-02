import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGroupMembersHouseholdView } from "@/domain/households/group-display";
import type { GroupMemberRow } from "@/lib/groups/types";

export type HouseholdMemberDetail = {
  userId: string;
  displayName: string;
};

export type UserHouseholdInGroup = {
  groupId: string;
  groupName: string;
  household: {
    id: string;
    name: string;
    members: HouseholdMemberDetail[];
  } | null;
};

export async function listUserHouseholdsByGroup(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserHouseholdInGroup[]> {
  const { data: memberships, error: membershipError } = await supabase
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

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const groups: { id: string; name: string }[] = [];
  for (const row of memberships ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (group) {
      groups.push({ id: group.id, name: group.name });
    }
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));

  const results: UserHouseholdInGroup[] = [];

  for (const group of groups) {
    const { data: membershipRow, error: hmError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (hmError) {
      throw new Error(hmError.message);
    }

    if (!membershipRow) {
      results.push({ groupId: group.id, groupName: group.name, household: null });
      continue;
    }

    const householdId = membershipRow.household_id as string;

    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("id, name")
      .eq("id", householdId)
      .maybeSingle();

    if (householdError) {
      throw new Error(householdError.message);
    }
    if (!household) {
      results.push({ groupId: group.id, groupName: group.name, household: null });
      continue;
    }

    const { data: members, error: membersError } = await supabase
      .from("household_members")
      .select(
        `
        user_id,
        profiles:user_id (
          display_name
        )
      `,
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });

    if (membersError) {
      throw new Error(membersError.message);
    }

    results.push({
      groupId: group.id,
      groupName: group.name,
      household: {
        id: household.id,
        name: household.name,
        members: (members ?? []).map((member) => {
          const rawProfile = member.profiles as
            | { display_name: string }
            | { display_name: string }[]
            | null;
          const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
          return {
            userId: member.user_id as string,
            displayName: profile?.display_name ?? "Member",
          };
        }),
      },
    });
  }

  return results;
}

export async function getGroupHouseholdMemberView(
  supabase: SupabaseClient,
  groupId: string,
  members: GroupMemberRow[],
) {
  const { data: households, error: householdsError } = await supabase
    .from("households")
    .select("id, name")
    .eq("group_id", groupId);

  if (householdsError) {
    throw new Error(householdsError.message);
  }

  const { data: householdMembers, error: hmError } = await supabase
    .from("household_members")
    .select(
      `
      household_id,
      user_id,
      profiles:user_id (
        display_name
      )
    `,
    )
    .eq("group_id", groupId);

  if (hmError) {
    throw new Error(hmError.message);
  }

  const mappedMembers = (householdMembers ?? []).map((row) => {
    const rawProfile = row.profiles as
      | { display_name: string }
      | { display_name: string }[]
      | null;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    return {
      householdId: row.household_id as string,
      userId: row.user_id as string,
      displayName: profile?.display_name ?? "Member",
    };
  });

  return buildGroupMembersHouseholdView(
    members,
    (households ?? []).map((household) => ({
      id: household.id as string,
      name: household.name as string,
    })),
    mappedMembers,
  );
}
