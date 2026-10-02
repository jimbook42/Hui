import type { HostAssignmentSnapshot } from "./types";

export function pickAcceptedHost(
  assignments: HostAssignmentSnapshot[],
): HostAssignmentSnapshot | null {
  return assignments.find((row) => row.status === "accepted") ?? null;
}

export function pickPendingHostProposal(
  assignments: HostAssignmentSnapshot[],
): HostAssignmentSnapshot | null {
  const proposals = assignments.filter((row) => row.status === "proposed");
  if (proposals.length === 0) {
    return null;
  }
  return proposals.reduce((latest, row) =>
    row.createdAt > latest.createdAt ? row : latest,
  );
}
