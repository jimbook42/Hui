import { describe, expect, it } from "vitest";

import { applySessionVisitIncrement } from "./install-visits";

describe("applySessionVisitIncrement", () => {
  it("increments only once when the member crosses several pages in one session", () => {
    let visitCount = 0;
    let sessionAlreadyCounted = false;

    for (const _page of ["sign-in", "onboarding", "dashboard"]) {
      const next = applySessionVisitIncrement({ visitCount, sessionAlreadyCounted });
      visitCount = next.visitCount;
      sessionAlreadyCounted = next.sessionAlreadyCounted;
    }

    expect(visitCount).toBe(1);
    expect(sessionAlreadyCounted).toBe(true);
  });

  it("increments again on a later session", () => {
    const firstSession = applySessionVisitIncrement({
      visitCount: 0,
      sessionAlreadyCounted: false,
    });
    expect(firstSession.visitCount).toBe(1);

    const secondSession = applySessionVisitIncrement({
      visitCount: firstSession.visitCount,
      sessionAlreadyCounted: false,
    });
    expect(secondSession.visitCount).toBe(2);
  });
});
