export const GATHERING_MAX_RING_MEMBERS = 12;

export type GatheringSlot = {
  memberIndex: number;
  /** 0–100, percentage of container width */
  x: number;
  /** 0–100, percentage of container height */
  y: number;
};

/**
 * Place members on an ellipse around a central gathering point.
 * Indices are stable for a given count so layout does not jump when responses update.
 */
export function layoutGatheringRing(
  memberCount: number,
  maxVisible = GATHERING_MAX_RING_MEMBERS,
): { slots: GatheringSlot[]; overflowCount: number } {
  const visible = Math.min(memberCount, maxVisible);
  const overflowCount = Math.max(0, memberCount - maxVisible);

  if (visible === 0) {
    return { slots: [], overflowCount: 0 };
  }

  const slots: GatheringSlot[] = [];
  const centerX = 50;
  const centerY = 50;
  const radiusX = 38;
  const radiusY = 34;
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < visible; i += 1) {
    const angle = startAngle + (2 * Math.PI * i) / visible;
    slots.push({
      memberIndex: i,
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
    });
  }

  return { slots, overflowCount };
}

export type GatheringStageSlot = {
  /** Index into the (ordered) member list. */
  memberIndex: number;
  /** 0–100, percentage of the square stage. */
  x: number;
  y: number;
  ring: "inner" | "outer";
};

export const GATHERING_STAGE_CAPACITY = 24;
const INNER_RING_MAX = 8;

/**
 * Place members around a central gathering point on a square stage.
 * Up to 8 members form a single ring; larger groups use an inner + outer ring
 * (capacity 24). Anything beyond that is reported as overflow and summarised
 * with counts rather than drawn.
 */
export function layoutGatheringStage(
  memberCount: number,
  capacity = GATHERING_STAGE_CAPACITY,
): { slots: GatheringStageSlot[]; overflowCount: number; denseRing: boolean } {
  const visible = Math.min(memberCount, capacity);
  const overflowCount = Math.max(0, memberCount - capacity);
  if (visible === 0) {
    return { slots: [], overflowCount: 0, denseRing: false };
  }

  const startAngle = -Math.PI / 2;
  const slots: GatheringStageSlot[] = [];

  const place = (
    count: number,
    radius: number,
    ring: GatheringStageSlot["ring"],
    offset: number,
    angleShift: number,
  ) => {
    for (let i = 0; i < count; i += 1) {
      const angle = startAngle + angleShift + (2 * Math.PI * i) / count;
      slots.push({
        memberIndex: offset + i,
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle),
        ring,
      });
    }
  };

  if (visible <= INNER_RING_MAX) {
    place(visible, 35, "outer", 0, 0);
    return { slots, overflowCount, denseRing: false };
  }

  const inner = Math.min(INNER_RING_MAX, Math.ceil(visible / 3));
  const outer = visible - inner;
  place(inner, 22, "inner", 0, Math.PI / inner);
  place(outer, 40, "outer", inner, 0);
  return { slots, overflowCount, denseRing: true };
}

const STATE_PRIORITY: Record<string, number> = { yes: 0, maybe: 1, pending: 2, no: 3 };

/**
 * Keep roster order while everyone fits (layout stays stable between responses).
 * When the group is larger than the stage, show people who are coming first.
 */
export function orderMembersForStage<T>(
  members: T[],
  stateOf: (member: T) => string,
  capacity = GATHERING_STAGE_CAPACITY,
): T[] {
  if (members.length <= capacity) {
    return members;
  }
  return members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => {
      const diff = (STATE_PRIORITY[stateOf(a.member)] ?? 2) - (STATE_PRIORITY[stateOf(b.member)] ?? 2);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.member);
}
