import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";

export type ContributionBoard = {
  stillNeeded: ContributionCategoryRow[];
  claimed: EventContributionRow[];
  mine: EventContributionRow[];
};

export function buildContributionBoard(
  categories: ContributionCategoryRow[],
  contributions: EventContributionRow[],
  viewerUserId: string,
): ContributionBoard {
  const activeCategories = categories.filter((c) => c.archivedAt === null);
  const claimed = contributions.filter((c) => c.status === "accepted");
  const claimedCategoryIds = new Set(
    claimed.map((c) => c.categoryId).filter((id): id is string => id !== null),
  );

  const stillNeeded = activeCategories.filter((cat) => !claimedCategoryIds.has(cat.id));
  const mine = claimed.filter((c) => c.userId === viewerUserId);

  return { stillNeeded, claimed, mine };
}

export type ContributionHistoryEntry = {
  userId: string;
  displayName: string;
  count: number;
};

export function buildContributionHistory(
  rows: { userId: string; displayName: string }[],
): ContributionHistoryEntry[] {
  const counts = new Map<string, ContributionHistoryEntry>();
  for (const row of rows) {
    const existing = counts.get(row.userId);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName,
        count: 1,
      });
    }
  }
  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}
