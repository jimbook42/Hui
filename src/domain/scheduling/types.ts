/** Member-facing availability labels (stored as yes/no/maybe in the database). */
export type AvailabilityChoice = "available" | "unavailable" | "maybe";

export type DbResponseValue = "yes" | "no" | "maybe";

export type CandidateStatus = "proposed" | "selected" | "withdrawn" | "declined";

export const ACTIVE_CANDIDATE_STATUSES: readonly CandidateStatus[] = [
  "proposed",
  "selected",
];
