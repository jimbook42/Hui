import type { EventStatus } from "@/domain/events/types";
import {
  formatClockTime,
  formatShortDay,
  formatTimeSpan,
} from "@/domain/datetime/display";

type HomeEventTimeLineInput = {
  status: EventStatus;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  proposalDatePassed: boolean;
  leadingProposedTime: boolean;
  planning: boolean;
  featured?: boolean;
};

/**
 * Clock line on Home / group cards — plain language when we are previewing the leading option.
 */
export function formatHomeEventTimeLine({
  status,
  startsAt,
  endsAt,
  timeZone,
  proposalDatePassed,
  leadingProposedTime,
  planning,
  featured = false,
}: HomeEventTimeLineInput): string {
  if (status === "cancelled") {
    return startsAt
      ? `Cancelled · ${formatShortDay(startsAt, timeZone)} · ${formatClockTime(startsAt, timeZone)}`
      : "Cancelled";
  }
  if (proposalDatePassed && status === "proposing") {
    return "This proposal's date has passed";
  }
  if (!startsAt) {
    return planning ? "Time proposed — not confirmed yet" : "Time still to be agreed";
  }

  const when = featured
    ? formatTimeSpan(startsAt, endsAt, timeZone)
    : formatClockTime(startsAt, timeZone);
  const dayAndTime = `${formatShortDay(startsAt, timeZone)} · ${when}`;

  if (leadingProposedTime) {
    return `Most popular time so far · ${dayAndTime} · not locked in yet`;
  }
  if (planning && status !== "confirmed") {
    return `Proposed · ${dayAndTime}`;
  }
  return dayAndTime;
}
