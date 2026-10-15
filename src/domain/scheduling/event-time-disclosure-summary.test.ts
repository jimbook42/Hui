import { describe, expect, it } from "vitest";

import { formatEventTimeDisclosureSummary } from "@/domain/scheduling/event-time-disclosure-summary";
import { REASKING_STATUS_PILL_LABEL } from "@/domain/scheduling/confirmed-because";

describe("formatEventTimeDisclosureSummary", () => {
  it("shows Re-asking after reschedule when consensus is not met again", () => {
    const summary = formatEventTimeDisclosureSummary({
      status: "confirmed",
      startsAt: "2026-10-19T05:00:00.000Z",
      timeZone: "Pacific/Auckland",
      consensusCurrentlyPasses: false,
      candidateCount: 1,
      passingCandidateCount: 0,
    });
    expect(summary).toContain(REASKING_STATUS_PILL_LABEL);
    expect(summary).not.toMatch(/^Confirmed ·/);
  });

  it("shows Confirmed when consensus passes", () => {
    const summary = formatEventTimeDisclosureSummary({
      status: "confirmed",
      startsAt: "2026-10-19T05:00:00.000Z",
      timeZone: "Pacific/Auckland",
      consensusCurrentlyPasses: true,
      candidateCount: 1,
      passingCandidateCount: 1,
    });
    expect(summary).toMatch(/^Confirmed ·/);
  });
});
