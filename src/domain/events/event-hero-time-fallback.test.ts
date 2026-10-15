import { describe, expect, it } from "vitest";

import { eventHeroTimeFallbackCopy } from "./event-hero-time-fallback";

describe("eventHeroTimeFallbackCopy", () => {
  it("uses cancelled wording instead of time-to-be-agreed", () => {
    const copy = eventHeroTimeFallbackCopy("cancelled");
    expect(copy?.title).toBe("Cancelled");
    expect(copy?.subtitle).toContain("no longer going ahead");
  });

  it("keeps planning fallback for proposing without a time", () => {
    const copy = eventHeroTimeFallbackCopy("proposing");
    expect(copy?.title).toBe("Time still to be agreed");
  });
});
