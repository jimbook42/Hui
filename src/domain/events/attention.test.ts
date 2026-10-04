import { describe, expect, it } from "vitest";

import { buildEventAttention, type EventAttentionFacts } from "@/domain/events/attention";

const base: EventAttentionFacts = {
  status: "proposing",
  hasCandidate: true,
  canRespond: true,
  viewerResponse: "available",
  canAcceptHostProposal: false,
  canConfirmTime: false,
  unclaimedContributionCount: 0,
  canCoordinateContributions: true,
  viewerHasContribution: false,
};

describe("buildEventAttention", () => {
  it("asks for a response only when the viewer has not answered", () => {
    expect(buildEventAttention(base)).toEqual([]);
    const items = buildEventAttention({ ...base, viewerResponse: null });
    expect(items.map((i) => i.kind)).toEqual(["respond"]);
  });

  it("does not ask for a response when there is no time on the table", () => {
    expect(buildEventAttention({ ...base, viewerResponse: null, hasCandidate: false })).toEqual([]);
  });

  it("orders respond, host, confirm, contribute", () => {
    const items = buildEventAttention({
      ...base,
      status: "confirmed",
      viewerResponse: null,
      canAcceptHostProposal: true,
      canConfirmTime: true,
      unclaimedContributionCount: 3,
    });
    expect(items.map((i) => i.kind)).toEqual(["respond", "host", "confirm", "contribute"]);
    expect(items[3].title).toBe("3 things still need someone");
  });

  it("only nudges contributions on confirmed events when the viewer has none", () => {
    const facts = { ...base, unclaimedContributionCount: 2 };
    expect(buildEventAttention(facts)).toEqual([]);
    expect(buildEventAttention({ ...facts, status: "confirmed", viewerHasContribution: true })).toEqual([]);
    expect(buildEventAttention({ ...facts, status: "confirmed" }).map((i) => i.kind)).toEqual(["contribute"]);
  });

  it("is silent for cancelled and completed events", () => {
    for (const status of ["cancelled", "completed"] as const) {
      expect(
        buildEventAttention({
          ...base,
          status,
          viewerResponse: null,
          canAcceptHostProposal: true,
          canConfirmTime: true,
        }),
      ).toEqual([]);
    }
  });
});
