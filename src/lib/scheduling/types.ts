import type { ConsensusFailureReason, ConsensusRule } from "@/domain/scheduling/consensus";
import type { AvailabilityChoice, CandidateStatus } from "@/domain/scheduling/types";

export type EventCandidateRow = {
  id: string;
  startsAt: string;
  /** Optional: a proposed time may be start-only. */
  endsAt: string | null;
  status: CandidateStatus;
  proposedBy: string;
  createdAt: string;
  viewerResponse: AvailabilityChoice | null;
  viewerPrivateNote: string | null;
};

export type EventSchedulingContext = {
  candidates: EventCandidateRow[];
  withdrawnCandidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  consensusRule: ConsensusRule;
};

export type CandidateConsensusView = {
  candidateId: string;
  startsAt: string;
  endsAt: string | null;
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
  failureReason: ConsensusFailureReason | "candidate_not_active" | null;
};

export type EventConsensusSummary = {
  eligibleMemberCount: number;
  minimumAttendees: number;
  consensusRule: ConsensusRule;
  maybeResponsesEnabled: boolean;
  candidates: CandidateConsensusView[];
};
