const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM_PATTERN = /^(\d{2}):(\d{2})$/;

/** yyyy-MM-dd wall-clock date → e.g. "Sat 31 Oct 2026" (en-NZ). */
export function formatWallClockDateLabel(
  isoDate: string,
  locale = "en-NZ",
): string | null {
  const match = ISO_DATE_PATTERN.exec(isoDate.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** HH:mm wall-clock time → e.g. "12:00 pm" (en-NZ). */
export function formatWallClockTimeLabel(hhmm: string, locale = "en-NZ"): string | null {
  const match = HHMM_PATTERN.exec(hhmm.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  const date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWallClockTimeRangeLabel(
  startHhmm: string,
  endHhmm: string,
  locale = "en-NZ",
): string | null {
  const start = formatWallClockTimeLabel(startHhmm, locale);
  const end = formatWallClockTimeLabel(endHhmm, locale);
  if (!start || !end) {
    return null;
  }
  return `${start} – ${end}`;
}
