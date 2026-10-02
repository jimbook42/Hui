import type { DietaryCategory } from "@/domain/dietary/validation";

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
};

export type GroupSharedDietaryRow = {
  entryId: string;
  userId: string;
  displayName: string;
  category: DietaryCategory;
  label: string;
  notes: string | null;
};

export type UserGroupOption = {
  groupId: string;
  groupName: string;
};
