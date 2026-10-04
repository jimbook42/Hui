import { describe, expect, it } from "vitest";

import {
  GATHERING_MAX_RING_MEMBERS,
  GATHERING_STAGE_CAPACITY,
  layoutGatheringRing,
  layoutGatheringStage,
  orderMembersForStage,
} from "./gathering-layout";

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

describe("layoutGatheringStage", () => {
  it("returns nothing for an empty group", () => {
    expect(layoutGatheringStage(0)).toEqual({ slots: [], overflowCount: 0, denseRing: false });
  });

  it("uses a single ring for small groups", () => {
    const { slots, denseRing } = layoutGatheringStage(6);
    expect(denseRing).toBe(false);
    expect(slots).toHaveLength(6);
    expect(new Set(slots.map((slot) => slot.ring))).toEqual(new Set(["outer"]));
  });

  it("uses an inner and outer ring for larger groups", () => {
    const { slots, denseRing } = layoutGatheringStage(18);
    expect(denseRing).toBe(true);
    expect(slots).toHaveLength(18);
    expect(slots.filter((slot) => slot.ring === "inner").length).toBeGreaterThan(0);
    expect(slots.filter((slot) => slot.ring === "outer").length).toBeGreaterThan(
      slots.filter((slot) => slot.ring === "inner").length,
    );
    // Every dot stays on the stage.
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(100);
      expect(slot.y).toBeGreaterThan(0);
      expect(slot.y).toBeLessThan(100);
    }
  });

  it("reports overflow beyond stage capacity", () => {
    const { slots, overflowCount } = layoutGatheringStage(GATHERING_STAGE_CAPACITY + 7);
    expect(slots).toHaveLength(GATHERING_STAGE_CAPACITY);
    expect(overflowCount).toBe(7);
  });

  it("gives every member a unique slot index", () => {
    const { slots } = layoutGatheringStage(20);
    expect(new Set(slots.map((slot) => slot.memberIndex)).size).toBe(20);
  });
});

describe("orderMembersForStage", () => {
  const states = ["no", "pending", "yes", "maybe"];
  const members = states.map((state, index) => ({ id: index, state }));

  it("keeps roster order while everyone fits", () => {
    expect(orderMembersForStage(members, (m) => m.state)).toEqual(members);
  });

  it("puts people who are coming first once the stage is full", () => {
    const many = Array.from({ length: GATHERING_STAGE_CAPACITY + 2 }, (_, id) => ({
      id,
      state: id % 4 === 0 ? "yes" : "no",
    }));
    const ordered = orderMembersForStage(many, (m) => m.state);
    expect(ordered[0].state).toBe("yes");
    const lastYes = ordered.map((m) => m.state).lastIndexOf("yes");
    const firstNo = ordered.map((m) => m.state).indexOf("no");
    expect(lastYes).toBeLessThan(firstNo);
  });
});
