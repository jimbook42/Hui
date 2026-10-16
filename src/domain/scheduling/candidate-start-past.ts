export const PROPOSAL_PAST_START_TITLE = "That time has already passed";
export const PROPOSAL_PAST_START_BODY = "Pick a time in the future.";
export const PROPOSAL_PAST_START_ERROR = `${PROPOSAL_PAST_START_TITLE}. ${PROPOSAL_PAST_START_BODY}`;

/** True when the candidate start instant is not strictly after now (UTC ISO compare). */
export function isCandidateStartInPast(startsAt: string, nowIso: string): boolean {
  if (!startsAt || !nowIso) {
    return false;
  }
  return startsAt <= nowIso;
}

export function validateCandidateStartNotPast(
  startsAt: string,
  nowIso: string,
): string | null {
  if (isCandidateStartInPast(startsAt, nowIso)) {
    return PROPOSAL_PAST_START_ERROR;
  }
  return null;
}

export type ProposedCandidateLike = {
  id: string;
  startsAt: string;
  status: string;
};

/** Proposed times that have not yet started — used for counts, respond, and host pick. */
export function activeProposedCandidates<T extends ProposedCandidateLike>(
  candidates: T[],
  nowIso: string,
): T[] {
  return candidates.filter(
    (candidate) =>
      candidate.status === "proposed" &&
      !isCandidateStartInPast(candidate.startsAt, nowIso),
  );
}

export function isPassedProposedCandidate(
  candidate: ProposedCandidateLike,
  nowIso: string,
): boolean {
  return candidate.status === "proposed" && isCandidateStartInPast(candidate.startsAt, nowIso);
}
