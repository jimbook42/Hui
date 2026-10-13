export const GATHERING_MAX_RING_MEMBERS = 12;

export type GatheringSlot = {
  memberIndex: number;
  /** 0-100, percentage of container width */
  x: number;
  /** 0-100, percentage of container height */
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
  /** 0-100, percentage of the square stage. */
  x: number;
  y: number;
  ring: "inner" | "outer";
};

export type GatheringRing = {
  ring: GatheringStageSlot["ring"];
  /** Radius in the 0-100 stage space. */
  radius: number;
  /** Number of members on this ring. */
  count: number;
  /** Index of the first member on this ring in the ordered member list. */
  offset: number;
  /** Extra angular offset (radians) added to the ring's start angle. */
  angleShift: number;
};

export type GatheringStageLayout = {
  slots: GatheringStageSlot[];
  overflowCount: number;
  denseRing: boolean;
  rings: GatheringRing[];
};

export const GATHERING_STAGE_CAPACITY = 24;
const INNER_RING_MAX = 8;

const DEGREES = 180 / Math.PI;

/**
 * Where a ring starts. Matches the Hui logo: with three members the nodes sit at 10, 2 and
 * 6 o'clock, i.e. the first node is half a step anticlockwise of 12 o'clock
 * (-90 degrees - 180 degrees / n).
 */
function ringStartAngle(count: number, angleShift: number): number {
  return -Math.PI / 2 - Math.PI / count + angleShift;
}

/**
 * Place members around a central gathering point on a square stage.
 * Up to 8 members form a single ring; larger groups use an inner + outer ring
 * (capacity 24). Anything beyond that is reported as overflow and summarised
 * with counts rather than drawn.
 */
export function layoutGatheringStage(
  memberCount: number,
  capacity = GATHERING_STAGE_CAPACITY,
): GatheringStageLayout {
  const visible = Math.min(memberCount, capacity);
  const overflowCount = Math.max(0, memberCount - capacity);
  if (visible === 0) {
    return { slots: [], overflowCount: 0, denseRing: false, rings: [] };
  }

  const slots: GatheringStageSlot[] = [];
  const rings: GatheringRing[] = [];

  const place = (
    count: number,
    radius: number,
    ring: GatheringStageSlot["ring"],
    offset: number,
    angleShift: number,
  ) => {
    rings.push({ ring, radius, count, offset, angleShift });
    for (let i = 0; i < count; i += 1) {
      const angle = ringStartAngle(count, angleShift) + (2 * Math.PI * i) / count;
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
    return { slots, overflowCount, denseRing: false, rings };
  }

  const inner = Math.min(INNER_RING_MAX, Math.ceil(visible / 3));
  const outer = visible - inner;
  place(inner, 22, "inner", 0, Math.PI / inner);
  place(outer, 40, "outer", inner, 0);
  return { slots, overflowCount, denseRing: true, rings };
}

export type GatheringArc = {
  /** Index into the ordered member list of the node this arc starts at. */
  fromMemberIndex: number;
  /** Index of the node this arc ends at (next around the ring). */
  toMemberIndex: number;
  /** SVG path in the 0-100 stage space, clockwise, between the two nodes. */
  d: string;
  ring: GatheringStageSlot["ring"];
};

export type GatheringArcStrength = "solid" | "partial" | "open";

/**
 * Strength of the arc between two neighbours (the logo's ring, filling in as people say yes):
 * solid when both are coming, partial when both are at least "maybe", otherwise open.
 */
export function gatheringArcStrength(a: string, b: string): GatheringArcStrength {
  if (a === "yes" && b === "yes") {
    return "solid";
  }
  const ok = (state: string) => state === "yes" || state === "maybe";
  return ok(a) && ok(b) ? "partial" : "open";
}

const ARC_PADDING_UNITS = 2.4;
const MIN_ARC_DEGREES = 8;

function polar(radius: number, degrees: number): { x: number; y: number } {
  const rad = degrees / DEGREES;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

/**
 * Arcs joining consecutive members on a ring, leaving room (in stage units) around each node so
 * the arcs never touch the nodes - like the gaps in the Hui logo. Rings too crowded to show a
 * readable arc yield none.
 */
export function layoutGatheringArcs(ring: GatheringRing, nodeRadiusUnits: number): GatheringArc[] {
  if (ring.count < 2) {
    return [];
  }
  const stepDegrees = 360 / ring.count;
  const gapDegrees = ((nodeRadiusUnits + ARC_PADDING_UNITS) / ring.radius) * DEGREES;
  if (stepDegrees - 2 * gapDegrees < MIN_ARC_DEGREES) {
    return [];
  }

  const startDegrees = ringStartAngle(ring.count, ring.angleShift) * DEGREES;
  const arcs: GatheringArc[] = [];
  for (let i = 0; i < ring.count; i += 1) {
    const nodeAngle = startDegrees + stepDegrees * i;
    const from = polar(ring.radius, nodeAngle + gapDegrees);
    const to = polar(ring.radius, nodeAngle + stepDegrees - gapDegrees);
    arcs.push({
      fromMemberIndex: ring.offset + i,
      toMemberIndex: ring.offset + ((i + 1) % ring.count),
      d: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${ring.radius} ${ring.radius} 0 0 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
      ring: ring.ring,
    });
  }
  return arcs;
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
