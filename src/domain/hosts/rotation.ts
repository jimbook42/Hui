export type HostHistoryEntry = {
  userId: string;
  displayName: string;
  count: number;
};

export type HostEligibleMember = {
  userId: string;
  displayName: string;
  hostingStanding?: "default" | "always" | "prefer_not" | "never";
};

export function filterHostEligibleMembers(
  members: HostEligibleMember[],
  excludedUserIds: readonly string[] = [],
): HostEligibleMember[] {
  const excluded = new Set(excludedUserIds);
  return members.filter(
    (member) =>
      member.hostingStanding !== "never" && !excluded.has(member.userId),
  );
}

export type HostSuggestion = {
  userId: string;
  displayName: string;
  hostedCount: number;
  reason: string;
};

/** Factual counts from accepted member hosts on confirmed/completed events — not a score. */
export function buildHostHistory(
  rows: { userId: string; displayName: string }[],
): HostHistoryEntry[] {
  const counts = new Map<string, HostHistoryEntry>();
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
  return [...counts.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function hostSuggestionReason(displayName: string, hostedCount: number): string {
  if (hostedCount === 0) {
    return `Hui has suggested ${displayName} to host this gathering.`;
  }
  return `Hui has suggested ${displayName} to host this gathering.`;
}

export function suggestHost(
  eligibleMembers: HostEligibleMember[],
  history: HostHistoryEntry[],
): HostSuggestion | null {
  if (eligibleMembers.length === 0) {
    return null;
  }

  const countByUser = new Map(history.map((entry) => [entry.userId, entry.count]));

  let minCount = Number.POSITIVE_INFINITY;
  for (const member of eligibleMembers) {
    const count = countByUser.get(member.userId) ?? 0;
    if (count < minCount) {
      minCount = count;
    }
  }

  const tied = eligibleMembers
    .filter((member) => (countByUser.get(member.userId) ?? 0) === minCount)
    .sort((a, b) => {
      const byName = a.displayName.localeCompare(b.displayName);
      if (byName !== 0) {
        return byName;
      }
      return a.userId.localeCompare(b.userId);
    });

  const picked = tied[0];
  const hostedCount = countByUser.get(picked.userId) ?? 0;

  return {
    userId: picked.userId,
    displayName: picked.displayName,
    hostedCount,
    reason: hostSuggestionReason(picked.displayName, hostedCount),
  };
}
