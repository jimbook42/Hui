import { formatLongDay, formatTimeSpan } from "@/domain/datetime/display";

export type EventDateBadgeParts = {
  day: string;
  month: string;
};

export type EventHeroDateCopy = {
  startsAt: string;
  timeZone: string;
  badge: EventDateBadgeParts | null;
  longDay: string;
  timeSpan: string;
  showRelativeWhen: boolean;
};

export function formatEventDateBadgeParts(
  startsAt: string,
  timeZone: string,
): EventDateBadgeParts | null {
  try {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const day = new Intl.DateTimeFormat("en-NZ", { day: "numeric", timeZone }).format(date);
    const month = new Intl.DateTimeFormat("en-NZ", { month: "short", timeZone })
      .format(date)
      .replace(/\./g, "")
      .toUpperCase();
    return { day, month };
  } catch {
    return null;
  }
}

/** Single server-side snapshot for the event hero date block (no client Intl). */
export function buildEventHeroDateCopy(input: {
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  showRelativeWhen: boolean;
  referenceNow?: Date;
}): EventHeroDateCopy | null {
  if (!input.startsAt) {
    return null;
  }
  const badge = formatEventDateBadgeParts(input.startsAt, input.timeZone);
  const longDay = formatLongDay(input.startsAt, input.timeZone);
  const timeSpan = formatTimeSpan(input.startsAt, input.endsAt, input.timeZone);
  return {
    startsAt: input.startsAt,
    timeZone: input.timeZone,
    badge,
    longDay,
    timeSpan,
    showRelativeWhen: input.showRelativeWhen,
  };
}
