import type { DietaryCategory } from "@/domain/dietary/validation";

export type DietaryScope = "group" | "all_groups";

export type DietaryShareRef = {
  groupId: string;
  groupName: string;
};

export type UserDietaryEntry = {
  id: string;
  category: DietaryCategory;
  label: string;
  notes: string | null;
  shares: DietaryShareRef[];
  /** Owner opted in to showing this entry to every group they are in (HUI-026U.3). */
  shareWithAllGroups: boolean;
};

export type GroupSharedDietaryRow = {
  entryId: string;
  userId: string;
  displayName: string;
  category: DietaryCategory;
  label: string;
  notes: string | null;
  /** Why the viewer can see it: shared with this group specifically, or via the owner's all-groups setting. */
  scope: DietaryScope;
};

export type UserGroupOption = {
  groupId: string;
  groupName: string;
};
