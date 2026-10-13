import {
  formatClockTime,
  formatLongDay,
  formatShortDay,
  formatTimeSpan,
} from "@/domain/datetime/display";

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Convert a datetime-local style wall clock (no offset) in an IANA zone to UTC ISO.
 */
export function wallClockToUtcIso(local: string, timeZone: string): string | null {
  const trimmed = local.trim();
  const match = WALL_CLOCK_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = zoneOffsetMinutesAt(new Date(utcGuess), timeZone);
  const corrected = utcGuess - offsetMinutes * 60_000;
  return new Date(corrected).toISOString();
}

function zoneOffsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

export function formatInstantInTimeZone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  // Fixed locale so server and client render identical text (avoids hydration mismatches).
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    ...options,
  }).format(new Date(iso));
}

/** Compact range for proposal UI, e.g. "Sat 31 Oct, 6:30pm – 9:00pm". */
export function formatCompactEventTimeRange(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): string {
  const startDate = formatShortDay(startsAt, timeZone);
  const startTime = formatClockTime(startsAt, timeZone);
  if (!endsAt) {
    return `${startDate}, ${startTime}`;
  }
  const span = formatTimeSpan(startsAt, endsAt, timeZone);
  if (formatShortDay(startsAt, timeZone) === formatShortDay(endsAt, timeZone)) {
    return `${startDate}, ${span}`;
  }
  return `${startDate}, ${startTime} – ${formatShortDay(endsAt, timeZone)} ${formatClockTime(endsAt, timeZone)}`;
}

/** Long-form range for event/respond UI — uses fixed en-NZ field formatters for SSR/client parity. */
export function formatEventTimeRange(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): string {
  const start = `${formatLongDay(startsAt, timeZone)}, ${formatClockTime(startsAt, timeZone)}`;
  if (!endsAt) {
    return start;
  }
  if (formatShortDay(startsAt, timeZone) === formatShortDay(endsAt, timeZone)) {
    return `${start} — ${formatClockTime(endsAt, timeZone)}`;
  }
  const endFull = `${formatLongDay(endsAt, timeZone)}, ${formatClockTime(endsAt, timeZone)}`;
  return `${start} — ${endFull}`;
}

export function formatDateTimeLocalInTimeZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
