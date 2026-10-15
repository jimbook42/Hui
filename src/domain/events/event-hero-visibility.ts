import type { EventStatus } from "./types";

/** Show a fixed event time in the hero when we have a start instant (including cancelled, for context). */
export function shouldShowEventHeroTime(
  _status: EventStatus,
  startsAt: string | null,
): boolean {
  return Boolean(startsAt);
}
