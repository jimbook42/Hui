import type { UserDietaryEntry, UserGroupOption } from "@/lib/dietary/types";

export type DietaryGroupShareState = {
  groupId: string;
  groupName: string;
  /** All entries are shared with this group (explicit share or via all-groups). */
  enabled: boolean;
  /** Some but not all entries are shared — owner should pick a clear scope. */
  partial: boolean;
};

export type DietarySharingScopeState = {
  entryCount: number;
  shareAllGroups: boolean;
  shareAllPartial: boolean;
  groups: DietaryGroupShareState[];
};

function entrySharedWithGroup(entry: UserDietaryEntry, groupId: string): boolean {
  if (entry.shareWithAllGroups) {
    return true;
  }
  return entry.shares.some((share) => share.groupId === groupId);
}

export function deriveDietarySharingScope(
  entries: UserDietaryEntry[],
  groups: UserGroupOption[],
): DietarySharingScopeState {
  const shareAllGroups =
    entries.length > 0 && entries.every((entry) => entry.shareWithAllGroups);
  const shareAllPartial =
    entries.some((entry) => entry.shareWithAllGroups) && !shareAllGroups;

  const groupStates = groups.map((group) => {
    const sharedCount = entries.filter((entry) => entrySharedWithGroup(entry, group.groupId)).length;
    return {
      groupId: group.groupId,
      groupName: group.groupName,
      enabled: entries.length > 0 && sharedCount === entries.length,
      partial: sharedCount > 0 && sharedCount < entries.length,
    };
  });

  return {
    entryCount: entries.length,
    shareAllGroups,
    shareAllPartial,
    groups: groupStates,
  };
}
