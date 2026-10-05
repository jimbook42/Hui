import { describe, expect, it } from "vitest";

import { buildProposedHuiGuidance } from "./proposed-guidance";

describe("buildProposedHuiGuidance", () => {
  const base = {
    status: "proposing" as const,
    isProposer: true,
    canRespond: true,
    viewerResponse: null,
    hasCandidate: true,
    canFinalise: true,
    anyCandidatePassesConsensus: false,
  };

  it("shows guidance for a proposer right after proposing", () => {
    const guidance = buildProposedHuiGuidance(base, { justProposed: true });
    expect(guidance.show).toBe(true);
    expect(guidance.headline).toBe("Hui proposed");
    expect(guidance.nextStepTitle).toBe("Your next step");
  });

  it("does not tell the proposer to respond again when they already have", () => {
    const guidance = buildProposedHuiGuidance(
      { ...base, viewerResponse: "available" },
      { justProposed: true },
    );
    expect(guidance.nextStepTitle).toBe("Waiting on the group");
    expect(guidance.nextStepDetail).not.toMatch(/Add your availability/i);
  });

  it("hides for non-proposers unless just proposed flag is unused", () => {
    const guidance = buildProposedHuiGuidance(
      { ...base, isProposer: false },
      { justProposed: false },
    );
    expect(guidance.show).toBe(false);
  });
});
