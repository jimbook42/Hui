import type { GroupMemberRow } from "@/lib/groups/types";

export type HouseholdMemberRow = {
  userId: string;
  displayName: string;
};

export type HouseholdGroupBlock = {
  householdId: string;
  householdName: string;
  members: HouseholdMemberRow[];
};

export type GroupMembersHouseholdView = {
  households: HouseholdGroupBlock[];
  ungroupedMembers: HouseholdMemberRow[];
};

export function buildGroupMembersHouseholdView(
  members: GroupMemberRow[],
  households: { id: string; name: string }[],
  householdMembers: { householdId: string; userId: string; displayName: string }[],
): GroupMembersHouseholdView {
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const householdNameById = new Map(households.map((household) => [household.id, household.name]));

  const membersByHousehold = new Map<string, HouseholdMemberRow[]>();
  const assignedUserIds = new Set<string>();

  for (const row of householdMembers) {
    if (!memberById.has(row.userId)) {
      continue;
    }
    assignedUserIds.add(row.userId);
    const list = membersByHousehold.get(row.householdId) ?? [];
    list.push({ userId: row.userId, displayName: row.displayName });
    membersByHousehold.set(row.householdId, list);
  }

  const householdsBlocks: HouseholdGroupBlock[] = [];
  for (const household of households) {
    const blockMembers = membersByHousehold.get(household.id) ?? [];
    if (blockMembers.length === 0) {
      continue;
    }
    blockMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));
    householdsBlocks.push({
      householdId: household.id,
      householdName: householdNameById.get(household.id) ?? household.name,
      members: blockMembers,
    });
  }

  householdsBlocks.sort((a, b) => a.householdName.localeCompare(b.householdName));

  const ungroupedMembers = members
    .filter((member) => !assignedUserIds.has(member.userId))
    .map((member) => ({ userId: member.userId, displayName: member.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { households: householdsBlocks, ungroupedMembers };
}
