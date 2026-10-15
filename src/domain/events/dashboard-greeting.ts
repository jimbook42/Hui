import { formatDateOnlyDisplay } from "@/domain/recurrence/date-only";

/** Subheading under "Kia ora" on the home dashboard. */
export function dashboardHuiGreetingLine(
  nextHuiStartsAtIso: string | null | undefined,
  timeZone: string,
  todayDateOnly: string,
): string {
  if (!nextHuiStartsAtIso) {
    return "Ready to plan your next hui?";
  }

  const eventDateOnly = formatDateOnlyInZone(nextHuiStartsAtIso, timeZone);
  const week = weekSpanForDate(todayDateOnly, eventDateOnly);
  if (week === "this") {
    return "Ready for this week's hui?";
  }
  if (week === "next") {
    return "Ready for next week's hui?";
  }
  const label = formatDateOnlyDisplay(eventDateOnly);
  return `Your next hui is ${label}.`;
}

function formatDateOnlyInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

function weekSpanForDate(todayDateOnly: string, eventDateOnly: string): "this" | "next" | "other" {
  const today = parseDateOnly(todayDateOnly);
  const event = parseDateOnly(eventDateOnly);
  const todayWeekStart = startOfWeekMonday(today);
  const eventWeekStart = startOfWeekMonday(event);
  const diffWeeks = Math.round(
    (eventWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  if (diffWeeks === 0) {
    return "this";
  }
  if (diffWeeks === 1) {
    return "next";
  }
  return "other";
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + offset);
  return monday;
}
