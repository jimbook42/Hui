/** Calendar-date helpers (nominal recurrence targets — not wall-clock instants). */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

export function compareDateOnly(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function addCadenceToDateOnly(
  dateOnly: string,
  unit: "week" | "month",
  count: number,
): string {
  if (!isDateOnly(dateOnly) || count < 1) {
    throw new Error("invalid cadence add");
  }
  const [y, m, d] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (unit === "week") {
    date.setUTCDate(date.getUTCDate() + count * 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + count);
  }
  return formatDateOnlyUtc(date);
}

export function formatDateOnlyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function subtractDaysFromDateOnly(dateOnly: string, days: number): string {
  if (!isDateOnly(dateOnly) || days < 0) {
    throw new Error("invalid date subtract");
  }
  const [y, m, d] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return formatDateOnlyUtc(date);
}
