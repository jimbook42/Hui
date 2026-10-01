import { describe, expect, it } from "vitest";

import {
  evaluateCandidateConsensus,
  selectPassingCandidate,
  type ConsensusEvaluationInput,
  type ConsensusMember,
} from "./consensus";

const members: ConsensusMember[] = [
  { userId: "a", consensusRequired: true },
  { userId: "b", consensusRequired: false },
  { userId: "c", consensusRequired: false },
];

function evaluate(
  overrides: Partial<ConsensusEvaluationInput> &
    Pick<ConsensusEvaluationInput, "consensusRule" | "responses">,
) {
  return evaluateCandidateConsensus({
    minimumAttendees: 2,
    maybeResponsesEnabled: true,
    members,
    ...overrides,
  });
}

describe("evaluateCandidateConsensus", () => {
  it("fails when accepted responses are below the minimum", () => {
    const result = evaluate({
      consensusRule: "minimum_attendees",
      responses: [{ userId: "a", response: "yes" }],
    });
    expect(result.passes).toBe(false);
    expect(result.acceptedCount).toBe(1);
    expect(result.failureReason).toBe("below_minimum_attendees");
    expect(result.minimumAttendees).toBe(2);
  });

  it("passes the minimum attendees rule when enough people accept", () => {
    const result = evaluate({
      consensusRule: "minimum_attendees",
      responses: [
        { userId: "a", response: "yes" },
        { userId: "b", response: "yes" },
      ],
    });
    expect(result.passes).toBe(true);
    expect(result.acceptedCount).toBe(2);
    expect(result.failureReason).toBeNull();
  });

  it("does not treat unavailable or missing responses as accepting", () => {
    const result = evaluate({
      consensusRule: "minimum_attendees",
      minimumAttendees: 1,
      responses: [
        { userId: "a", response: "no" },
        { userId: "outsider", response: "yes" },
      ],
    });
    expect(result.acceptedCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
    expect(result.noResponseCount).toBe(2);
    expect(result.passes).toBe(false);
    expect(result.failureReason).toBe("below_minimum_attendees");
  });

  it("counts maybe as accepting only when maybe responses are enabled", () => {
    const enabled = evaluate({
      consensusRule: "minimum_attendees",
      maybeResponsesEnabled: true,
      responses: [
        { userId: "a", response: "yes" },
        { userId: "b", response: "maybe" },
      ],
    });
    const disabled = evaluate({
      consensusRule: "minimum_attendees",
      maybeResponsesEnabled: false,
      responses: [
        { userId: "a", response: "yes" },
        { userId: "b", response: "maybe" },
      ],
    });

    expect(enabled.maybeCount).toBe(1);
    expect(enabled.acceptedCount).toBe(2);
    expect(enabled.passes).toBe(true);

    expect(disabled.maybeCount).toBe(1);
    expect(disabled.acceptedCount).toBe(1);
    expect(disabled.passes).toBe(false);
    expect(disabled.failureReason).toBe("below_minimum_attendees");
  });

  it("fails all active members until every eligible member accepts", () => {
    const failing = evaluate({
      consensusRule: "all_active_members",
      minimumAttendees: 1,
      responses: [
        { userId: "a", response: "yes" },
        { userId: "b", response: "yes" },
        { userId: "c", response: "no" },
      ],
    });
    const passing = evaluate({
      consensusRule: "all_active_members",
      minimumAttendees: 1,
      responses: [
        { userId: "a", response: "yes" },
        { userId: "b", response: "maybe" },
        { userId: "c", response: "yes" },
      ],
    });

    expect(failing.passes).toBe(false);
    expect(failing.failureReason).toBe("all_active_members");
    expect(failing.eligibleMemberCount).toBe(3);
    expect(passing.passes).toBe(true);
    expect(passing.acceptedCount).toBe(3);
  });

  it("requires every flagged participant and still applies the minimum", () => {
    const missingRequired = evaluate({
      consensusRule: "required_participants",
      minimumAttendees: 1,
      responses: [
        { userId: "b", response: "yes" },
        { userId: "c", response: "yes" },
      ],
    });
    const requiredOnly = evaluate({
      consensusRule: "required_participants",
      minimumAttendees: 2,
      responses: [{ userId: "a", response: "yes" }],
    });
    const passing = evaluate({
      consensusRule: "required_participants",
      minimumAttendees: 2,
      responses: [
        { userId: "a", response: "maybe" },
        { userId: "b", response: "yes" },
      ],
    });

    expect(missingRequired.failureReason).toBe("required_participants");
    expect(missingRequired.requiredParticipantCount).toBe(1);
    expect(missingRequired.requiredAcceptedCount).toBe(0);
    expect(requiredOnly.failureReason).toBe("below_minimum_attendees");
    expect(passing.passes).toBe(true);
  });

  it("treats an empty required-participant set as no extra people to satisfy", () => {
    const result = evaluate({
      consensusRule: "required_participants",
      minimumAttendees: 1,
      members: [
        { userId: "a", consensusRequired: false },
        { userId: "b", consensusRequired: false },
      ],
      responses: [{ userId: "a", response: "yes" }],
    });
    expect(result.requiredParticipantCount).toBe(0);
    expect(result.passes).toBe(true);
  });

  it("is deterministic for the same members and responses in any order", () => {
    const first = evaluate({
      consensusRule: "all_active_members",
      minimumAttendees: 1,
      members: [...members].reverse(),
      responses: [
        { userId: "c", response: "yes" },
        { userId: "a", response: "no" },
        { userId: "b", response: "maybe" },
      ],
    });
    const second = evaluate({
      consensusRule: "all_active_members",
      minimumAttendees: 1,
      members,
      responses: [
        { userId: "b", response: "maybe" },
        { userId: "c", response: "yes" },
        { userId: "a", response: "no" },
      ],
    });
    expect(second).toEqual(first);
  });
});

describe("selectPassingCandidate", () => {
  it("picks the earliest start, then the smallest id, regardless of input order", () => {
    const later = {
      id: "00000000-0000-4000-8000-000000000002",
      startsAt: "2026-11-02T18:00:00.000Z",
      passes: true,
    };
    const earlierLowerId = {
      id: "00000000-0000-4000-8000-000000000001",
      startsAt: "2026-11-01T18:00:00.000Z",
      passes: true,
    };
    const earlierHigherId = {
      id: "00000000-0000-4000-8000-000000000009",
      startsAt: "2026-11-01T18:00:00.000Z",
      passes: true,
    };
    const failing = {
      id: "00000000-0000-4000-8000-000000000000",
      startsAt: "2026-10-01T18:00:00.000Z",
      passes: false,
    };

    const forward = selectPassingCandidate([
      failing,
      later,
      earlierHigherId,
      earlierLowerId,
    ]);
    const backward = selectPassingCandidate([
      earlierLowerId,
      earlierHigherId,
      later,
      failing,
    ]);

    expect(forward?.id).toBe(earlierLowerId.id);
    expect(backward?.id).toBe(earlierLowerId.id);
  });
});
