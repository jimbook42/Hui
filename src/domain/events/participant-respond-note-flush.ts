import type { AvailabilityChoice } from "@/domain/scheduling/types";

/** Candidate rows that may have a private note to persist before leaving the time step. */
export function candidateIdsNeedingNoteFlushBeforeAdvance(
  responsesByCandidate: Record<string, AvailabilityChoice | null>,
  candidateIds: readonly string[],
): string[] {
  return candidateIds.filter((id) => responsesByCandidate[id] === "unavailable");
}
