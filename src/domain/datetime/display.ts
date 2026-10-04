const LOCALE = "en-NZ";

function fmt(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, { timeZone, ...options }).format(new Date(iso));
  } catch {
    return "";
  }
}

function lowerMeridiem(value: string): string {
  return value.replace(/\s?(am|pm)/i, (_, m: string) => m.toLowerCase()).replace(/\s/g, "");
}

/** "6:30pm" */
export function formatClockTime(iso: string, timeZone: string): string {
  return lowerMeridiem(fmt(iso, timeZone, { hour: "numeric", minute: "2-digit", hour12: true }));
}

/** "Sat 31 Oct" */
export function formatShortDay(iso: string, timeZone: string): string {
  return fmt(iso, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/,/g, "");
}

/** "Saturday 31 October" */
export function formatLongDay(iso: string, timeZone: string): string {
  return fmt(iso, timeZone, { weekday: "long", day: "numeric", month: "long" }).replace(/,/g, "");
}

/** "6:30pm – 9:00pm" (or a single time when the end is missing or equal). */
export function formatTimeSpan(startsAt: string, endsAt: string | null, timeZone: string): string {
  const start = formatClockTime(startsAt, timeZone);
  if (!endsAt || endsAt === startsAt) {
    return start;
  }
  const sameDay = formatShortDay(startsAt, timeZone) === formatShortDay(endsAt, timeZone);
  const end = sameDay
    ? formatClockTime(endsAt, timeZone)
    : `${formatShortDay(endsAt, timeZone)} ${formatClockTime(endsAt, timeZone)}`;
  return `${start} – ${end}`;
}

/** "Sat 31 Oct · 6:30pm" — single line for cards. */
export function formatDayAndTime(startsAt: string, timeZone: string): string {
  return `${formatShortDay(startsAt, timeZone)} · ${formatClockTime(startsAt, timeZone)}`;
}

function dayKey(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return Date.UTC(read("year"), read("month") - 1, read("day")) / 86_400_000;
}

/** Whole calendar days from `now` to `iso` in the given zone (negative when past). */
export function calendarDaysFrom(iso: string, timeZone: string, now: Date = new Date()): number {
  return Math.round(dayKey(iso, timeZone) - dayKey(now.toISOString(), timeZone));
}

/** "Today", "Tomorrow", "In 5 days", "Next week", "2 days ago" … */
export function relativeDayLabel(iso: string, timeZone: string, now: Date = new Date()): string {
  const days = calendarDaysFrom(iso, timeZone, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days >= 7 && days < 14) return "Next week";
  if (days >= 14 && days < 60) return `In ${Math.round(days / 7)} weeks`;
  if (days >= 60) return `In ${Math.round(days / 30)} months`;
  if (days > -7) return `${Math.abs(days)} days ago`;
  return formatShortDay(iso, timeZone);
}
