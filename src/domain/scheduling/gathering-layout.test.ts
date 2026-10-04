import { describe, expect, it } from "vitest";

import { GATHERING_MAX_RING_MEMBERS, layoutGatheringRing } from "./gathering-layout";

describe("layoutGatheringRing", () => {
  it("returns no slots for zero members", () => {
    expect(layoutGatheringRing(0)).toEqual({ slots: [], overflowCount: 0 });
  });

  it("places one member above center", () => {
    const { slots, overflowCount } = layoutGatheringRing(1);
    expect(overflowCount).toBe(0);
    expect(slots).toHaveLength(1);
    expect(slots[0].y).toBeLessThan(50);
  });

  it("caps visible slots and reports overflow", () => {
    const count = GATHERING_MAX_RING_MEMBERS + 5;
    const { slots, overflowCount } = layoutGatheringRing(count);
    expect(slots).toHaveLength(GATHERING_MAX_RING_MEMBERS);
    expect(overflowCount).toBe(5);
  });
});
