import { formatClockTime, formatShortDay } from "@/domain/datetime/display";
import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import type { EventStatus } from "@/domain/events/types";

export const DEFAULT_PROPOSAL_DEADLINE_HOURS = 48;

export function effectiveProposalDeadlineHours(groupHours: number | null): number {
  if (groupHours === null || !Number.isFinite(groupHours) || groupHours <= 0) {
    return DEFAULT_PROPOSAL_DEADLINE_HOURS;
  }
  return groupHours;
}

export function computeDefaultResponseDeadlineAt(
  from: Date,
  groupHours: number | null,
): Date {
  const hours = effectiveProposalDeadlineHours(groupHours);
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function formatProposalDeadlineDefaultNote(groupHours: number | null): string {
  const hours = effectiveProposalDeadlineHours(groupHours);
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `default: ${days} ${days === 1 ? "day" : "days"}`;
  }
  return `default: ${hours} hours`;
}

export function proposalReplyByPreviewLabel(
  deadlineAt: string | null,
  timeZone: string,
): string {
  if (!deadlineAt?.trim()) {
    return "Not set";
  }
  return replyByDeadlineLabel(deadlineAt, timeZone);
}

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
