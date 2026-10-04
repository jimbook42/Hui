import { describe, expect, it } from "vitest";

import {
  GATHERING_MAX_RING_MEMBERS,
  GATHERING_STAGE_CAPACITY,
  gatheringArcStrength,
  layoutGatheringArcs,
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
    expect(layoutGatheringStage(0)).toEqual({ slots: [], overflowCount: 0, denseRing: false, rings: [] });
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

describe("logo geometry", () => {
  it("places three members at 10, 2 and 6 o'clock like the Hui logo", () => {
    const { slots } = layoutGatheringStage(3);
    const [a, b, c] = slots;
    // 10 o'clock: left of and above centre; 2 o'clock: right of and above; 6 o'clock: directly below.
    expect(a.x).toBeLessThan(50);
    expect(a.y).toBeLessThan(50);
    expect(b.x).toBeGreaterThan(50);
    expect(b.y).toBeLessThan(50);
    expect(c.x).toBeCloseTo(50, 5);
    expect(c.y).toBeGreaterThan(50);
  });

  it("starts two members at 9 and 3 o'clock", () => {
    const { slots } = layoutGatheringStage(2);
    expect(slots[0].x).toBeCloseTo(15, 5);
    expect(slots[0].y).toBeCloseTo(50, 5);
  });
});

describe("layoutGatheringArcs", () => {
  it("yields one arc per member, joining neighbours around the ring", () => {
    const { rings } = layoutGatheringStage(3);
    const arcs = layoutGatheringArcs(rings[0], 6.5);
    expect(arcs).toHaveLength(3);
    expect(arcs.map((arc) => [arc.fromMemberIndex, arc.toMemberIndex])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    for (const arc of arcs) {
      expect(arc.d).toMatch(/^M [\d.]+ [\d.]+ A 35 35 0 0 1 [\d.]+ [\d.]+$/);
    }
  });

  it("draws nothing for a single member", () => {
    const { rings } = layoutGatheringStage(1);
    expect(layoutGatheringArcs(rings[0], 6.5)).toEqual([]);
  });

  it("drops arcs on a ring too crowded to read", () => {
    const { rings } = layoutGatheringStage(GATHERING_STAGE_CAPACITY);
    const outer = rings.find((ring) => ring.ring === "outer")!;
    expect(layoutGatheringArcs(outer, 7)).toEqual([]);
  });

  it("indexes arcs on the outer ring after the inner members", () => {
    const { rings } = layoutGatheringStage(10);
    const outer = rings.find((ring) => ring.ring === "outer")!;
    const arcs = layoutGatheringArcs(outer, 4);
    expect(arcs[0].fromMemberIndex).toBe(outer.offset);
    expect(arcs[arcs.length - 1].toMemberIndex).toBe(outer.offset);
  });
});

describe("gatheringArcStrength", () => {
  it("is solid only when both neighbours are coming", () => {
    expect(gatheringArcStrength("yes", "yes")).toBe("solid");
  });

  it("is partial when everyone is at least a maybe", () => {
    expect(gatheringArcStrength("yes", "maybe")).toBe("partial");
    expect(gatheringArcStrength("maybe", "maybe")).toBe("partial");
  });

  it("stays open when someone is out or has not answered", () => {
    expect(gatheringArcStrength("yes", "no")).toBe("open");
    expect(gatheringArcStrength("pending", "yes")).toBe("open");
  });
});
