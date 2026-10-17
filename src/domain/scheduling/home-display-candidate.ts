import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { compareCandidatesBySchedule } from "@/domain/scheduling/consensus";
import type { CandidateStatus } from "@/domain/scheduling/types";

export type HomeDisplayCandidateRef = {
  id: string;
  starts_at: string;
  status: CandidateStatus;
};

export function yesCountFromAttendanceRoster(roster: AttendanceRoster): number {
  return roster.members.filter((member) => member.response === "yes").length;
}

function yesCountFor(
  candidateId: string,
  yesCountByCandidateId: ReadonlyMap<string, number>,
): number {
  return yesCountByCandidateId.get(candidateId) ?? 0;
}

/**
 * Which proposed time to surface on Home when several are open: most can come, then earliest.
 * Selected (locked-in) times always win.
 */
export function pickHomeDisplayCandidate(
  candidates: readonly HomeDisplayCandidateRef[],
  yesCountByCandidateId: ReadonlyMap<string, number>,
): HomeDisplayCandidateRef | null {
  const selected = candidates.find((candidate) => candidate.status === "selected");
  if (selected) {
    return selected;
  }
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length === 0) {
    return null;
  }
  if (proposed.length === 1) {
    return proposed[0];
  }

  const maxYes = Math.max(...proposed.map((candidate) => yesCountFor(candidate.id, yesCountByCandidateId)));
  const pool =
    maxYes > 0
      ? proposed.filter((candidate) => yesCountFor(candidate.id, yesCountByCandidateId) === maxYes)
      : proposed;

  return (
    [...pool].sort((a, b) =>
      compareCandidatesBySchedule(
        { id: a.id, startsAt: a.starts_at },
        { id: b.id, startsAt: b.starts_at },
      ),
    )[0] ?? null
  );
}

/** True when the card should say this is the leading option, not a locked-in time. */
export function homeShowsLeadingProposedTime(
  candidates: readonly HomeDisplayCandidateRef[],
  picked: HomeDisplayCandidateRef | null,
  yesCountByCandidateId: ReadonlyMap<string, number>,
): boolean {
  if (!picked || picked.status === "selected") {
    return false;
  }
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length <= 1) {
    return false;
  }
  const pickedYes = yesCountFor(picked.id, yesCountByCandidateId);
  const maxYes = Math.max(...proposed.map((candidate) => yesCountFor(candidate.id, yesCountByCandidateId)));
  return maxYes > 0 && pickedYes === maxYes;
}
