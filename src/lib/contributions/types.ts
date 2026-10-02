export type ContributionCategoryRow = {
  id: string;
  groupId: string;
  name: string;
  archivedAt: string | null;
  followsHost: boolean;
  defaultAssigneeUserId: string | null;
};

export type EventContributionRow = {
  id: string;
  eventId: string;
  groupId: string;
  categoryId: string | null;
  categoryName: string | null;
  userId: string | null;
  label: string;
  status: string;
  displayName: string | null;
};

export type GroupContributionHistory = {
  entries: { userId: string; displayName: string; count: number }[];
  viewerCount: number | null;
};
