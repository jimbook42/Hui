import type { EventStatus } from "@/domain/events/types";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { countAttendance } from "@/domain/scheduling/attendance-visual";
import type { ParticipantTimeCandidate } from "@/domain/events/participant-flow";

export type AttendanceCountSummary = ReturnType<typeof countAttendance>;

export function formatWhoIsComingSummary(
  counts: AttendanceCountSummary,
  maybeResponsesEnabled: boolean,
  options?: { eventStatus?: EventStatus },
): string {
  if (
    options?.eventStatus === "confirmed" &&
    counts.yes === 0 &&
    (counts.pending > 0 || (counts.maybe === 0 && counts.no === 0))
  ) {
    return "Awaiting answers";
  }
  const parts = [`${counts.yes} coming`];
  if (counts.maybe > 0 && maybeResponsesEnabled) {
    parts.push(`${counts.maybe} maybe`);
  }
  if (counts.no > 0) {
    parts.push(`${counts.no} can't`);
  }
  if (counts.pending > 0) {
    parts.push(`${counts.pending} yet to answer`);
  }
  return parts.join(" · ");
}

export type PerCandidateWhoIsComingRow = {
  candidateId: string;
  summary: string;
  roster: AttendanceRoster;
};

/**
 * Before confirmation, multi-time hui show tallies per proposed time; otherwise one focus roster.
 */
export function whoIsComingPresentation(input: {
  eventStatus: EventStatus;
  candidates: ParticipantTimeCandidate[];
  attendanceRosters: Record<string, AttendanceRoster>;
  maybeResponsesEnabled: boolean;
  focusCandidateId: string | null;
}): { mode: "single"; roster: AttendanceRoster | null; summary: string | null } | {
  mode: "per-candidate";
  rows: PerCandidateWhoIsComingRow[];
} {
  const proposed = input.candidates.filter((candidate) => candidate.status === "proposed");
  if (input.eventStatus === "proposing" && proposed.length > 1) {
    const rows: PerCandidateWhoIsComingRow[] = [];
    for (const candidate of proposed) {
      const roster = input.attendanceRosters[candidate.id];
      if (!roster || roster.members.length === 0) {
        continue;
      }
      const counts = countAttendance(roster.members, input.maybeResponsesEnabled);
      rows.push({
        candidateId: candidate.id,
        summary: formatWhoIsComingSummary(counts, input.maybeResponsesEnabled, {
          eventStatus: input.eventStatus,
        }),
        roster,
      });
    }
    if (rows.length > 0) {
      return { mode: "per-candidate", rows };
    }
  }

  const roster =
    input.focusCandidateId !== null
      ? (input.attendanceRosters[input.focusCandidateId] ?? null)
      : null;
  const summary =
    roster && roster.members.length > 0
      ? formatWhoIsComingSummary(
          countAttendance(roster.members, input.maybeResponsesEnabled),
          input.maybeResponsesEnabled,
          { eventStatus: input.eventStatus },
        )
      : null;
  return { mode: "single", roster, summary };
}
