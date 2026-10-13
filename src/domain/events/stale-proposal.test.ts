import { describe, expect, it } from "vitest";

import {
  STALE_PROPOSAL_GRACE_DAYS,
  isProposingEventStale,
  isStaleProposalAutoCancelDue,
  resolveProposalNominalDate,
  staleProposalAutoCancelDate,
} from "@/domain/events/stale-proposal";

describe("stale proposing events", () => {
  const tz = "Pacific/Auckland";

  it("prefers planning target over candidate instants", () => {
    expect(
      resolveProposalNominalDate({
        planningTargetDate: "2026-10-09",
        candidateStartInstants: ["2026-10-20T10:00:00.000Z"],
        timeZone: tz,
      }),
    ).toBe("2026-10-09");
  });

  it("uses earliest candidate day when no planning target", () => {
    expect(
      resolveProposalNominalDate({
        planningTargetDate: null,
        candidateStartInstants: [
          "2026-10-20T10:00:00.000Z",
          "2026-10-15T10:00:00.000Z",
        ],
        timeZone: "UTC",
      }),
    ).toBe("2026-10-15");
  });

  it("marks proposing past nominal as stale", () => {
    expect(isProposingEventStale("proposing", "2026-10-09", "2026-10-10")).toBe(true);
    expect(isProposingEventStale("proposing", "2026-10-10", "2026-10-10")).toBe(false);
    expect(isProposingEventStale("confirmed", "2026-10-09", "2026-10-10")).toBe(false);
  });

  it(`auto-cancels on or after nominal + ${STALE_PROPOSAL_GRACE_DAYS} days`, () => {
    const nominal = "2026-10-09";
    expect(staleProposalAutoCancelDate(nominal)).toBe("2026-10-12");
    expect(isStaleProposalAutoCancelDue(nominal, "2026-10-11")).toBe(false);
    expect(isStaleProposalAutoCancelDue(nominal, "2026-10-12")).toBe(true);
    expect(isStaleProposalAutoCancelDue(nominal, "2026-10-13")).toBe(true);
  });
});
