/**
 * Consensus evaluation for one candidate.
 *
 * Rules already stored on group_settings / group_memberships:
 * - minimum_attendees: accepting responses must reach minimumAttendees
 * - all_active_members: every eligible member must accept
 * - required_participants: every eligible member with consensusRequired must accept
 *
 * minimumAttendees is always required, including under the other two rules.
 * A maybe response accepts only when maybeResponsesEnabled is true.
 * Missing responses and responses from people outside the eligible set do not accept.
 */

export const CONSENSUS_RULES = [
  "required_participants",
  "minimum_attendees",
  "all_active_members",
] as const;

export type ConsensusRule = (typeof CONSENSUS_RULES)[number];

export type ConsensusResponse = "yes" | "no" | "maybe";

export const CONSENSUS_FAILURE_REASONS = [
  "below_minimum_attendees",
  "required_participants",
  "all_active_members",
] as const;

export type ConsensusFailureReason = (typeof CONSENSUS_FAILURE_REASONS)[number];

export type ConsensusMember = {
  userId: string;
  consensusRequired: boolean;
};

export type ConsensusResponseInput = {
  userId: string;
  response: ConsensusResponse;
};

export type ConsensusEvaluationInput = {
  consensusRule: ConsensusRule;
  minimumAttendees: number;
  maybeResponsesEnabled: boolean;
  members: readonly ConsensusMember[];
  responses: readonly ConsensusResponseInput[];
};

export type ConsensusEvaluation = {
  passes: boolean;
  acceptedCount: number;
  maybeCount: number;
  unavailableCount: number;
  noResponseCount: number;
  eligibleMemberCount: number;
  minimumAttendees: number;
  consensusRule: ConsensusRule;
  maybeResponsesEnabled: boolean;
  requiredParticipantCount: number;
  requiredAcceptedCount: number;
  failureReason: ConsensusFailureReason | null;
};

export type ScheduledCandidateRef = {
  id: string;
  startsAt: string;
};

export function isConsensusRule(value: string): value is ConsensusRule {
  return (CONSENSUS_RULES as readonly string[]).includes(value);
}

export function responseAccepts(
  response: ConsensusResponse | null,
  maybeResponsesEnabled: boolean,
): boolean {
  if (response === "yes") {
    return true;
  }
  if (response === "maybe") {
    return maybeResponsesEnabled;
  }
  return false;
}

function uniqueMembers(members: readonly ConsensusMember[]): ConsensusMember[] {
  const byId = new Map<string, ConsensusMember>();
  for (const member of members) {
    byId.set(member.userId, member);
  }
  return [...byId.values()];
}

function latestResponses(
  responses: readonly ConsensusResponseInput[],
): Map<string, ConsensusResponse> {
  const byUser = new Map<string, ConsensusResponse>();
  for (const row of responses) {
    byUser.set(row.userId, row.response);
  }
  return byUser;
}

export function evaluateCandidateConsensus(
  input: ConsensusEvaluationInput,
): ConsensusEvaluation {
  const members = uniqueMembers(input.members);
  const responses = latestResponses(input.responses);

  let acceptedCount = 0;
  let maybeCount = 0;
  let unavailableCount = 0;
  let respondedCount = 0;
  let requiredAcceptedCount = 0;
  const requiredParticipantCount = members.filter((member) => member.consensusRequired).length;

  for (const member of members) {
    const response = responses.get(member.userId) ?? null;
    if (response === null) {
      continue;
    }
    respondedCount += 1;
    if (response === "maybe") {
      maybeCount += 1;
    }
    if (response === "no") {
      unavailableCount += 1;
    }
    if (!responseAccepts(response, input.maybeResponsesEnabled)) {
      continue;
    }
    acceptedCount += 1;
    if (member.consensusRequired) {
      requiredAcceptedCount += 1;
    }
  }

  const eligibleMemberCount = members.length;
  const noResponseCount = eligibleMemberCount - respondedCount;

  let failureReason: ConsensusFailureReason | null = null;
  if (acceptedCount < input.minimumAttendees) {
    failureReason = "below_minimum_attendees";
  } else if (
    input.consensusRule === "all_active_members" &&
    acceptedCount < eligibleMemberCount
  ) {
    failureReason = "all_active_members";
  } else if (
    input.consensusRule === "required_participants" &&
    requiredAcceptedCount < requiredParticipantCount
  ) {
    failureReason = "required_participants";
  }

  return {
    passes: failureReason === null,
    acceptedCount,
    maybeCount,
    unavailableCount,
    noResponseCount,
    eligibleMemberCount,
    minimumAttendees: input.minimumAttendees,
    consensusRule: input.consensusRule,
    maybeResponsesEnabled: input.maybeResponsesEnabled,
    requiredParticipantCount,
    requiredAcceptedCount,
    failureReason,
  };
}

export function compareCandidatesBySchedule(
  a: ScheduledCandidateRef,
  b: ScheduledCandidateRef,
): number {
  if (a.startsAt < b.startsAt) {
    return -1;
  }
  if (a.startsAt > b.startsAt) {
    return 1;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}

/**
 * Stable display order for candidates that already pass.
 * Finalisation does not call this to replace an explicit candidate id.
 */
export function selectPassingCandidate<T extends ScheduledCandidateRef & { passes: boolean }>(
  candidates: readonly T[],
): T | null {
  const passing = candidates.filter((candidate) => candidate.passes);
  if (passing.length === 0) {
    return null;
  }
  return [...passing].sort(compareCandidatesBySchedule)[0] ?? null;
}
