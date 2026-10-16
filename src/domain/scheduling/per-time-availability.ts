import type { CandidateConsensusView } from "@/lib/scheduling/types";

export function perTimeAvailabilityRowLabel(evaluation: CandidateConsensusView): string {
  return `${evaluation.yesCount} can · ${evaluation.unavailableCount} can't`;
}
