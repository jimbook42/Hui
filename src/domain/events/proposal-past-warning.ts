import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import type { ProposalCandidateInput } from "@/domain/events/proposal";
import { isProposalDateBeforeToday } from "@/domain/events/proposal-past-time";
import {
  PROPOSAL_PAST_START_BODY,
  isCandidateStartInPast,
} from "@/domain/scheduling/candidate-start-past";
import {
  STALE_PROPOSAL_GRACE_DAYS,
  formatStaleProposalAutoCancelClause,
  instantToDateOnlyInTimeZone,
  resolveProposalNominalDate,
} from "@/domain/events/stale-proposal";

export function proposalHasPastProposedTimes(input: {
  candidates: ProposalCandidateInput[];
  timeZone: string;
  todayDateOnly: string;
  nowIso: string;
  /** Wall-clock date being edited on the time step (YYYY-MM-DD). */
  pendingDateOnly?: string;
  pendingStartTime?: string;
  pendingTimeZone?: string;
}): boolean {
  if (
    input.pendingDateOnly &&
    isProposalDateBeforeToday(input.pendingDateOnly, input.todayDateOnly)
  ) {
    return true;
  }
  if (
    input.pendingDateOnly &&
    input.pendingStartTime &&
    input.pendingTimeZone &&
    input.pendingDateOnly === input.todayDateOnly
  ) {
    const startsAt = wallClockToUtcIso(
      `${input.pendingDateOnly}T${input.pendingStartTime}`,
      input.pendingTimeZone,
    );
    if (startsAt && isCandidateStartInPast(startsAt, input.nowIso)) {
      return true;
    }
  }
  for (const candidate of input.candidates) {
    const day = instantToDateOnlyInTimeZone(candidate.startsAt, input.timeZone);
    if (isProposalDateBeforeToday(day, input.todayDateOnly)) {
      return true;
    }
    if (isCandidateStartInPast(candidate.startsAt, input.nowIso)) {
      return true;
    }
  }
  return false;
}

export function buildProposingPastDateWarning(input: {
  draft: {
    candidates: ProposalCandidateInput[];
    recurrence: { planningTargetDate?: string | null } | null;
  };
  timeZone: string;
  todayDateOnly: string;
  nowIso: string;
  pendingDateOnly?: string;
  pendingStartTime?: string;
}): { title: string; detail: string } | null {
  const hasPast = proposalHasPastProposedTimes({
    candidates: input.draft.candidates,
    timeZone: input.timeZone,
    todayDateOnly: input.todayDateOnly,
    nowIso: input.nowIso,
    pendingDateOnly: input.pendingDateOnly,
    pendingStartTime: input.pendingStartTime,
    pendingTimeZone: input.timeZone,
  });
  if (!hasPast) {
    return null;
  }

  const nominalDate = resolveProposalNominalDate({
    planningTargetDate: input.draft.recurrence?.planningTargetDate ?? null,
    candidateStartInstants: input.draft.candidates.map((row) => row.startsAt),
    timeZone: input.timeZone,
  });

  const lines = [PROPOSAL_PAST_START_BODY];

  if (nominalDate && isProposalDateBeforeToday(nominalDate, input.todayDateOnly)) {
    const autoCancel = formatStaleProposalAutoCancelClause(nominalDate, input.todayDateOnly);
    lines.push(`The planning date would be in the past — ${autoCancel}`);
  } else if (nominalDate) {
    lines.push(
      `Unconfirmed proposals with a planning date in the past are auto-cancelled ${STALE_PROPOSAL_GRACE_DAYS} days after that date.`,
    );
  }

  return {
    title: "That time has already passed",
    detail: lines.join(" "),
  };
}
