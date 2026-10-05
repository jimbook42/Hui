import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";

export type ContributionSlotState =
  | "open"
  | "yours"
  | "claimed"
  | "host"
  | "host_pending"
  | "assigned";

export type ContributionSlot = {
  category: ContributionCategoryRow;
  contribution: EventContributionRow | null;
  state: ContributionSlotState;
  statusLabel: string;
};

function pickContributionForCategory(
  contributions: EventContributionRow[],
  categoryId: string,
): EventContributionRow | null {
  const rows = contributions.filter((row) => row.categoryId === categoryId);
  if (rows.length === 0) {
    return null;
  }
  const accepted = rows.find((row) => row.status === "accepted");
  if (accepted) {
    return accepted;
  }
  const withAssignee = rows.find((row) => row.userId !== null);
  return withAssignee ?? rows[0];
}

export function isContributionSlotFilled(contribution: EventContributionRow | null): boolean {
  if (!contribution) {
    return false;
  }
  return contribution.status === "accepted" || contribution.userId !== null;
}

export function buildContributionSlots(
  categories: ContributionCategoryRow[],
  contributions: EventContributionRow[],
  viewerUserId: string,
  acceptedHostUserId: string | null,
): ContributionSlot[] {
  const active = categories.filter((category) => category.archivedAt === null);

  return active.map((category) => {
    const contribution = pickContributionForCategory(contributions, category.id);
    const assigneeId = contribution?.userId ?? null;
    const filled = isContributionSlotFilled(contribution);

    if (!filled) {
      if (category.followsHost) {
        return {
          category,
          contribution,
          state: "open",
          statusLabel: acceptedHostUserId
            ? "Open until the host accepts"
            : "Open — follows whoever hosts",
        };
      }
      return {
        category,
        contribution,
        state: "open",
        statusLabel: "Open",
      };
    }

    if (category.followsHost && assigneeId !== null) {
      if (contribution?.status === "accepted" && assigneeId === acceptedHostUserId) {
        const label =
          assigneeId === viewerUserId ? "You're bringing this (host)" : "Host is bringing this";
        return { category, contribution, state: "host", statusLabel: label };
      }
      return {
        category,
        contribution,
        state: "host_pending",
        statusLabel: "Reserved for the host",
      };
    }

    if (assigneeId === viewerUserId) {
      const assignedByOther =
        contribution?.assignedByUserId !== null &&
        contribution?.assignedByUserId !== viewerUserId;
      return {
        category,
        contribution,
        state: "yours",
        statusLabel: assignedByOther
          ? `You're bringing this · Assigned by ${contribution?.assignedByDisplayName ?? "organiser"}`
          : "You're bringing this",
      };
    }

    const assignedByOther =
      contribution?.assignedByUserId !== null &&
      contribution?.assignedByUserId !== assigneeId;
    if (assignedByOther) {
      return {
        category,
        contribution,
        state: "assigned",
        statusLabel: `Assigned to ${contribution?.displayName ?? "member"} · by ${contribution?.assignedByDisplayName ?? "organiser"}`,
      };
    }

    return {
      category,
      contribution,
      state: "claimed",
      statusLabel: `Claimed by ${contribution?.displayName ?? "member"}`,
    };
  });
}

export function contributionCategoryHeadline(
  categoryName: string,
  contribution: EventContributionRow | undefined,
): string {
  if (!contribution || !isContributionSlotFilled(contribution)) {
    return `${categoryName} — Needed`;
  }
  return `${categoryName} — ${contribution.displayName ?? "Member"}`;
}

const SLOT_DISPLAY_PRIORITY: Record<ContributionSlotState, number> = {
  open: 0,
  host_pending: 1,
  yours: 2,
  host: 2,
  claimed: 3,
  assigned: 3,
};

/** Unclaimed slots first so needed items stand out on mobile. */
export function sortContributionSlotsForDisplay(slots: ContributionSlot[]): ContributionSlot[] {
  return [...slots].sort((a, b) => {
    const aOpen = !isContributionSlotFilled(a.contribution);
    const bOpen = !isContributionSlotFilled(b.contribution);
    if (aOpen !== bOpen) {
      return aOpen ? -1 : 1;
    }
    const priorityDiff = SLOT_DISPLAY_PRIORITY[a.state] - SLOT_DISPLAY_PRIORITY[b.state];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.category.name.localeCompare(b.category.name);
  });
}
