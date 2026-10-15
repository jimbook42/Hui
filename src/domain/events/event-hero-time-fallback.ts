import type { EventStatus } from "@/domain/events/types";

export type EventHeroTimeFallback = {
  title: string;
  subtitle: string;
};

/** Copy when the hero has no date block (no time on the event row / focus candidate). */
export function eventHeroTimeFallbackCopy(
  status: EventStatus,
): EventHeroTimeFallback | null {
  if (status === "cancelled") {
    return {
      title: "Cancelled",
      subtitle: "This hui is no longer going ahead.",
    };
  }
  if (status === "proposing" || status === "draft") {
    return {
      title: "Time still to be agreed",
      subtitle: "Nobody has put a time on the table yet.",
    };
  }
  return {
    title: "Time still to be agreed",
    subtitle: "Nobody has put a time on the table yet.",
  };
}
