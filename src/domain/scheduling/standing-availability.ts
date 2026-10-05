import type { AvailabilityChoice } from "./types";

export type StandingAvailabilityKind = "usually_available" | "usually_unavailable";

export type StandingAvailabilityWindow = {
  id: string;
  groupId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  kind: StandingAvailabilityKind;
};

export type StandingAvailabilityHint = {
  suggestedChoice: AvailabilityChoice;
  summary: string;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_SHORT_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function standingAvailabilityDayLabel(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek] ?? "Day";
}

export function minutesToHhmm(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, minutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseHhmmToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

export function isAllDayWindow(startMinute: number, endMinute: number): boolean {
  return startMinute === 0 && endMinute === 1440;
}

export function formatStandingWindowTimeRange(startMinute: number, endMinute: number): string {
  if (isAllDayWindow(startMinute, endMinute)) {
    return "All day";
  }
  const endDisplay = endMinute === 1440 ? "midnight" : minutesToHhmm(endMinute);
  return `${minutesToHhmm(startMinute)} – ${endDisplay}`;
}

export function formatStandingWindowLabel(window: StandingAvailabilityWindow): string {
  const day = standingAvailabilityDayLabel(window.dayOfWeek);
  const time = formatStandingWindowTimeRange(window.startMinute, window.endMinute);
  const kind =
    window.kind === "usually_available" ? "Usually available" : "Usually unavailable";
  return `${kind}: ${day}, ${time}`;
}

function localDayAndMinutes(iso: string, timeZone: string): { dayOfWeek: number; minutes: number } {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return {
    dayOfWeek: WEEKDAY_SHORT_TO_DOW[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

function candidateMinuteSpan(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): { dayOfWeek: number; startMinute: number; endMinute: number } {
  const start = localDayAndMinutes(startsAt, timeZone);
  if (!endsAt) {
    return {
      dayOfWeek: start.dayOfWeek,
      startMinute: start.minutes,
      endMinute: Math.min(1440, start.minutes + 120),
    };
  }

  const end = localDayAndMinutes(endsAt, timeZone);
  if (end.dayOfWeek === start.dayOfWeek) {
    return {
      dayOfWeek: start.dayOfWeek,
      startMinute: start.minutes,
      endMinute: Math.max(start.minutes + 1, end.minutes),
    };
  }

  return {
    dayOfWeek: start.dayOfWeek,
    startMinute: start.minutes,
    endMinute: 1440,
  };
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Infer a non-binding hint for one candidate from standing windows.
 * Unavailable overlaps win over available overlaps (safer default).
 */
export function inferStandingAvailabilityHint(
  windows: StandingAvailabilityWindow[],
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): StandingAvailabilityHint | null {
  if (windows.length === 0) {
    return null;
  }

  const span = candidateMinuteSpan(startsAt, endsAt, timeZone);
  const matching = windows.filter((window) => window.dayOfWeek === span.dayOfWeek);

  let hasAvailable = false;
  let hasUnavailable = false;

  for (const window of matching) {
    if (
      rangesOverlap(span.startMinute, span.endMinute, window.startMinute, window.endMinute)
    ) {
      if (window.kind === "usually_unavailable") {
        hasUnavailable = true;
      } else {
        hasAvailable = true;
      }
    }
  }

  if (hasUnavailable) {
    return {
      suggestedChoice: "unavailable",
      summary: "You're usually unavailable then",
    };
  }

  if (hasAvailable) {
    return {
      suggestedChoice: "available",
      summary: "Usually works for you",
    };
  }

  return null;
}
