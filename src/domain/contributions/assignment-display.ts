import type { EventContributionRow } from "@/lib/contributions/types";

/** True when an organiser (or manager) assigned someone else — not a self-claim. */
export function isOrganiserAssignedContribution(
  contribution: Pick<EventContributionRow, "userId" | "assignedByUserId">,
): boolean {
  const assignee = contribution.userId;
  const assigner = contribution.assignedByUserId;
  return assigner !== null && assignee !== null && assigner !== assignee;
}
