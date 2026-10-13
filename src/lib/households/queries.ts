import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGroupMembersHouseholdView } from "@/domain/households/group-display";
import type { GroupMemberRow } from "@/lib/groups/types";
import {
  listActiveMembershipGroups,
  type UserMembershipGroup,
} from "@/lib/groups/user-membership-groups";

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
  preloadedGroups?: UserMembershipGroup[],
): Promise<UserHouseholdInGroup[]> {
  const groups = preloadedGroups ?? (await listActiveMembershipGroups(supabase, userId));

  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((group) => group.groupId);

  const { data: userHouseholdRows, error: userHouseholdError } = await supabase
    .from("household_members")
    .select("group_id, household_id")
    .eq("user_id", userId)
    .in("group_id", groupIds);

  if (userHouseholdError) {
    throw new Error(userHouseholdError.message);
  }

  const householdIdByGroup = new Map<string, string>();
  for (const row of userHouseholdRows ?? []) {
    householdIdByGroup.set(row.group_id as string, row.household_id as string);
  }

  const householdIds = [...new Set(householdIdByGroup.values())];
  if (householdIds.length === 0) {
    return groups.map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      household: null,
    }));
  }

  const [{ data: households, error: householdsError }, { data: memberRows, error: membersError }] =
    await Promise.all([
      supabase.from("households").select("id, name").in("id", householdIds),
      supabase
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
        .in("household_id", householdIds)
        .order("created_at", { ascending: true }),
    ]);

  if (householdsError) {
    throw new Error(householdsError.message);
  }
  if (membersError) {
    throw new Error(membersError.message);
  }

  const householdMeta = new Map(
    (households ?? []).map((household) => [
      household.id as string,
      { id: household.id as string, name: household.name as string },
    ]),
  );

  const membersByHousehold = new Map<string, HouseholdMemberDetail[]>();
  for (const member of memberRows ?? []) {
    const householdId = member.household_id as string;
    const rawProfile = member.profiles as
      | { display_name: string }
      | { display_name: string }[]
      | null;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    const list = membersByHousehold.get(householdId) ?? [];
    list.push({
      userId: member.user_id as string,
      displayName: profile?.display_name ?? "Member",
    });
    membersByHousehold.set(householdId, list);
  }

  return groups.map((group) => {
    const householdId = householdIdByGroup.get(group.groupId);
    if (!householdId) {
      return { groupId: group.groupId, groupName: group.groupName, household: null };
    }
    const meta = householdMeta.get(householdId);
    if (!meta) {
      return { groupId: group.groupId, groupName: group.groupName, household: null };
    }
    return {
      groupId: group.groupId,
      groupName: group.groupName,
      household: {
        id: meta.id,
        name: meta.name,
        members: membersByHousehold.get(householdId) ?? [],
      },
    };
  });
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
