import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";

import type { EventActionState } from "@/app/events/actions";

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

export function confirmedDuringSaveCheckAnswerToast(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): string {
  const range = formatCompactEventTimeRange(startsAt, endsAt, timeZone);
  return `This hui was just confirmed for ${range}. Check your answer for that time.`;
}

/** Shown when the hui confirmed while the member answered a different proposed time. */
export function confirmedDuringSaveOtherAnswersLockedMessage(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): string {
  const range = formatCompactEventTimeRange(startsAt, endsAt, timeZone);
  return `This hui was just confirmed for ${range} — your other answers can't change.`;
}

/** Only retry a failed save when the answer was for the candidate that became selected. */
export function shouldRetryAvailabilitySaveAfterConfirmRace(
  originalCandidateId: string,
  selectedCandidateId: string | null,
): boolean {
  return (
    selectedCandidateId !== null && originalCandidateId === selectedCandidateId
  );
}

export function resolveConfirmRaceAfterFailedSave(input: {
  originalCandidateId: string;
  selected: { id: string; startsAt: string; endsAt: string | null } | null;
  timeZone: string;
  retrySucceeded: boolean;
}): EventActionState {
  const { selected, timeZone, originalCandidateId, retrySucceeded } = input;
  if (!selected) {
    return {
      notice: "This hui was just confirmed. Check your answer for that time.",
    };
  }

  if (
    shouldRetryAvailabilitySaveAfterConfirmRace(originalCandidateId, selected.id) &&
    retrySucceeded
  ) {
    return {
      message: "Response saved.",
      notice: confirmedDuringSaveToast(selected.startsAt, selected.endsAt, timeZone),
    };
  }

  if (originalCandidateId !== selected.id) {
    return {
      error: confirmedDuringSaveOtherAnswersLockedMessage(
        selected.startsAt,
        selected.endsAt,
        timeZone,
      ),
    };
  }

  return {
    error: confirmedDuringSaveCheckAnswerToast(
      selected.startsAt,
      selected.endsAt,
      timeZone,
    ),
  };
}
