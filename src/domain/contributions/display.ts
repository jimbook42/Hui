import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";

import { buildContributionSlots, isContributionSlotFilled } from "./slots";

export type ContributionBoard = {
  stillNeeded: ContributionCategoryRow[];
  claimed: EventContributionRow[];
  mine: EventContributionRow[];
};

function primaryContributionsPerCategory(
  contributions: EventContributionRow[],
): EventContributionRow[] {
  const byCategory = new Map<string, EventContributionRow>();
  for (const row of contributions) {
    const categoryId = row.categoryId;
    if (!categoryId) {
      continue;
    }
    const existing = byCategory.get(categoryId);
    if (
      !existing ||
      (isContributionSlotFilled(row) && !isContributionSlotFilled(existing))
    ) {
      byCategory.set(categoryId, row);
    } else if (row.status === "accepted" && existing.status !== "accepted") {
      byCategory.set(categoryId, row);
    }
  }
  return [...byCategory.values()];
}

export function buildContributionBoard(
  categories: ContributionCategoryRow[],
  contributions: EventContributionRow[],
  viewerUserId: string,
  acceptedHostUserId: string | null = null,
): ContributionBoard {
  const slots = buildContributionSlots(
    categories,
    contributions,
    viewerUserId,
    acceptedHostUserId,
  );
  const stillNeeded = slots.filter((slot) => !isContributionSlotFilled(slot.contribution)).map(
    (slot) => slot.category,
  );
  const primary = primaryContributionsPerCategory(contributions);
  const claimed = primary.filter((row) => isContributionSlotFilled(row));
  const mine = claimed.filter((row) => row.userId === viewerUserId);

  return { stillNeeded, claimed, mine };
}

export type ContributionHistoryEntry = {
  userId: string;
  displayName: string;
  count: number;
};

export function formatContributionDisclosureSummary(
  activeCategoryCount: number,
  unclaimedCount: number,
  claimedCount: number,
): string {
  if (activeCategoryCount === 0) {
    return "No categories yet";
  }
  if (unclaimedCount > 0) {
    return `${claimedCount} claimed · ${unclaimedCount} still needed`;
  }
  return "Everything is covered";
}

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
