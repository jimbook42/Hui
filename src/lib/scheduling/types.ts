import type { ConsensusFailureReason, ConsensusRule } from "@/domain/scheduling/consensus";
import type { AvailabilityChoice, CandidateStatus } from "@/domain/scheduling/types";

export type EventCandidateRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: CandidateStatus;
  proposedBy: string;
  createdAt: string;
  viewerResponse: AvailabilityChoice | null;
};

export type EventSchedulingContext = {
  candidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  consensusRule: ConsensusRule;
};

export type CandidateConsensusView = {
  candidateId: string;
  startsAt: string;
  endsAt: string;
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
