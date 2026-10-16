import { describe, expect, it } from "vitest";

import { perTimeAvailabilityRowLabel } from "./per-time-availability";
import type { CandidateConsensusView } from "@/lib/scheduling/types";

const base: CandidateConsensusView = {
  candidateId: "c1",
  startsAt: "2026-10-20T10:00:00Z",
  endsAt: null,
  passes: false,
  yesCount: 3,
  maybeCount: 1,
  unavailableCount: 2,
  noResponseCount: 0,
  acceptedCount: 3,
  minimumAttendees: 2,
  eligibleMemberCount: 6,
  failureReason: null,
  consensusRule: "majority_active_members",
  requiredParticipantCount: 0,
  requiredAcceptedCount: 0,
  maybeResponsesEnabled: false,
};

describe("perTimeAvailabilityRowLabel", () => {
  it("summarises can and can't counts for a row", () => {
    expect(perTimeAvailabilityRowLabel(base)).toBe("3 can · 2 can't");
  });
});
