import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";

export function isSchedulingClosedDbError(message: string): boolean {
  return /no longer open for scheduling changes/i.test(message);
}

export function confirmedDuringSaveToast(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): string {
  const range = formatCompactEventTimeRange(startsAt, endsAt, timeZone);
  return `This hui was just confirmed for ${range} — your answer for that time is saved.`;
}
