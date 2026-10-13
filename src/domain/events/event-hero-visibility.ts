import type { EventStatus } from "./types";

/** Show a fixed event time in the hero for confirmed and completed hui (not cancelled). */
export function shouldShowEventHeroTime(
  status: EventStatus,
  startsAt: string | null,
): boolean {
  return Boolean(startsAt) && status !== "cancelled";
}
