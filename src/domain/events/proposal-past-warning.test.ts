import { describe, expect, it } from "vitest";

import {
  buildProposingPastDateWarning,
  proposalHasPastProposedTimes,
} from "./proposal-past-warning";

describe("proposal past-date warning", () => {
  const tz = "Pacific/Auckland";

  it("detects a past pending date and past candidates", () => {
    expect(
      proposalHasPastProposedTimes({
        candidates: [],
        timeZone: tz,
        todayDateOnly: "2026-10-14",
        pendingDateOnly: "2026-10-01",
      }),
    ).toBe(true);
    expect(
      proposalHasPastProposedTimes({
        candidates: [{ startsAt: "2026-10-01T10:00:00.000Z", endsAt: null }],
        timeZone: "UTC",
        todayDateOnly: "2026-10-14",
      }),
    ).toBe(true);
    expect(
      proposalHasPastProposedTimes({
        candidates: [{ startsAt: "2026-11-01T10:00:00.000Z", endsAt: null }],
        timeZone: "UTC",
        todayDateOnly: "2026-10-14",
        pendingDateOnly: "2026-11-02",
      }),
    ).toBe(false);
  });

  it("builds warning copy for review when a candidate is in the past", () => {
    const warning = buildProposingPastDateWarning({
      draft: {
        candidates: [{ startsAt: "2026-10-01T10:00:00.000Z", endsAt: null }],
        recurrence: { planningTargetDate: "2026-10-01" },
      },
      timeZone: "UTC",
      todayDateOnly: "2026-10-14",
    });
    expect(warning?.title).toMatch(/in the past/i);
    expect(warning?.detail).toMatch(/cancelled automatically soon/i);
    expect(warning?.detail).not.toMatch(/on 2026-10-12/);
  });
});
