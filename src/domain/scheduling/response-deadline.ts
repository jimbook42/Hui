import { formatClockTime, formatShortDay } from "@/domain/datetime/display";
import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import type { EventStatus } from "@/domain/events/types";

export const DEFAULT_PROPOSAL_DEADLINE_HOURS = 48;

export function replyByLabelForEvent(
  status: EventStatus,
  responseDeadlineAt: string | null,
  timeZone: string,
): string | null {
  if (!eventAcceptsResponseDeadline(status) || !responseDeadlineAt) {
    return null;
  }
  return replyByDeadlineLabel(responseDeadlineAt, timeZone);
}

export function replyByDeadlineLabel(deadlineAt: string, timeZone: string): string {
  return `Reply by ${formatShortDay(deadlineAt, timeZone)} ${formatClockTime(deadlineAt, timeZone)}`;
}

export function isResponseDeadlinePassed(
  deadlineAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!deadlineAt) {
    return false;
  }
  return now.getTime() > new Date(deadlineAt).getTime();
}

export function deadlinePassedReplySummary(respondedCount: number, eligibleCount: number): string {
  return `Deadline passed: ${respondedCount} of ${eligibleCount} replied`;
}
