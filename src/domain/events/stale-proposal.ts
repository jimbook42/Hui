import { compareDateOnly, addDaysToDateOnly, isDateOnly } from "@/domain/recurrence/date-only";
import type { EventStatus } from "@/domain/events/types";

/** Days after the proposal nominal date before an unconfirmed proposing hui is auto-cancelled. */
export const STALE_PROPOSAL_GRACE_DAYS = 3;

export function instantToDateOnlyInTimeZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Nominal planning date for stale checks: recurring target, else earliest active candidate day. */
export function resolveProposalNominalDate(input: {
  planningTargetDate: string | null;
  candidateStartInstants: string[];
  timeZone: string;
}): string | null {
  if (input.planningTargetDate && isDateOnly(input.planningTargetDate)) {
    return input.planningTargetDate;
  }
  if (input.candidateStartInstants.length === 0) {
    return null;
  }
  let min: string | null = null;
  for (const instant of input.candidateStartInstants) {
    const day = instantToDateOnlyInTimeZone(instant, input.timeZone);
    if (!min || compareDateOnly(day, min) < 0) {
      min = day;
    }
  }
  return min;
}

export function isProposingEventStale(
  status: EventStatus,
  nominalDate: string | null,
  todayDateOnly: string,
): boolean {
  if (status !== "proposing" || !nominalDate || !isDateOnly(nominalDate)) {
    return false;
  }
  return compareDateOnly(nominalDate, todayDateOnly) < 0;
}

export function isStaleProposalAutoCancelDue(
  nominalDate: string,
  todayDateOnly: string,
  graceDays: number = STALE_PROPOSAL_GRACE_DAYS,
): boolean {
  if (!isDateOnly(nominalDate) || graceDays < 0) {
    return false;
  }
  const cancelOn = addDaysToDateOnly(nominalDate, graceDays);
  return compareDateOnly(todayDateOnly, cancelOn) >= 0;
}

export function staleProposalAutoCancelDate(
  nominalDate: string,
  graceDays: number = STALE_PROPOSAL_GRACE_DAYS,
): string {
  return addDaysToDateOnly(nominalDate, graceDays);
}

/**
 * Clause for organiser copy when a stale proposal may be auto-cancelled.
 * Omits a calendar date when the derived auto-cancel day is already in the past.
 */
export function formatStaleProposalAutoCancelClause(
  nominalDate: string,
  todayDateOnly: string,
  graceDays: number = STALE_PROPOSAL_GRACE_DAYS,
): string {
  const cancelOn = staleProposalAutoCancelDate(nominalDate, graceDays);
  if (compareDateOnly(todayDateOnly, cancelOn) >= 0) {
    return "it may be cancelled automatically soon if it stays unconfirmed.";
  }
  return `otherwise it will be cancelled automatically on ${cancelOn} (${graceDays} days after the passed date).`;
}
