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
