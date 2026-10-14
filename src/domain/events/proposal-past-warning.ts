import type { ProposalCandidateInput } from "@/domain/events/proposal";
import { isProposalDateBeforeToday } from "@/domain/events/proposal-past-time";
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
  /** Wall-clock date being edited on the time step (YYYY-MM-DD). */
  pendingDateOnly?: string;
}): boolean {
  if (
    input.pendingDateOnly &&
    isProposalDateBeforeToday(input.pendingDateOnly, input.todayDateOnly)
  ) {
    return true;
  }
  for (const candidate of input.candidates) {
    const day = instantToDateOnlyInTimeZone(candidate.startsAt, input.timeZone);
    if (isProposalDateBeforeToday(day, input.todayDateOnly)) {
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
  pendingDateOnly?: string;
}): { title: string; detail: string } | null {
  const hasPast = proposalHasPastProposedTimes({
    candidates: input.draft.candidates,
    timeZone: input.timeZone,
    todayDateOnly: input.todayDateOnly,
    pendingDateOnly: input.pendingDateOnly,
  });
  if (!hasPast) {
    return null;
  }

  const nominalDate = resolveProposalNominalDate({
    planningTargetDate: input.draft.recurrence?.planningTargetDate ?? null,
    candidateStartInstants: input.draft.candidates.map((row) => row.startsAt),
    timeZone: input.timeZone,
  });

  const lines = [
    "Proposing a time in the past can confuse members. Double-check before you continue.",
  ];

  if (nominalDate && isProposalDateBeforeToday(nominalDate, input.todayDateOnly)) {
    const autoCancel = formatStaleProposalAutoCancelClause(nominalDate, input.todayDateOnly);
    lines.push(`The planning date would be in the past — ${autoCancel}`);
  } else if (nominalDate) {
    lines.push(
      `Unconfirmed proposals with a planning date in the past are auto-cancelled ${STALE_PROPOSAL_GRACE_DAYS} days after that date.`,
    );
  }

  return {
    title: "A proposed time is in the past",
    detail: lines.join(" "),
  };
}
