import type { RosterMember } from "@/domain/scheduling/attendance-roster";

export type AttendanceVisualState = "yes" | "maybe" | "no" | "pending";

export function rosterResponseToVisualState(
  response: RosterMember["response"],
  maybeResponsesEnabled: boolean,
): AttendanceVisualState {
  switch (response) {
    case "yes":
      return "yes";
    case "maybe":
      return maybeResponsesEnabled ? "maybe" : "pending";
    case "no":
      return "no";
    default:
      return "pending";
  }
}

export function attendanceVisualAccessibleLabel(
  displayName: string,
  state: AttendanceVisualState,
): string {
  switch (state) {
    case "yes":
      return `${displayName}, can come`;
    case "maybe":
      return `${displayName}, could make it work`;
    case "no":
      return `${displayName}, can't come`;
    case "pending":
      return `${displayName}, no answer yet`;
  }
}

export type AttendanceCounts = Record<AttendanceVisualState, number> & { total: number };

/** Aggregate roster responses into the four visual states (maybe collapses to pending when disabled). */
export function countAttendance(
  members: readonly Pick<RosterMember, "response">[],
  maybeResponsesEnabled: boolean,
): AttendanceCounts {
  const counts: AttendanceCounts = { yes: 0, maybe: 0, no: 0, pending: 0, total: members.length };
  for (const member of members) {
    counts[rosterResponseToVisualState(member.response, maybeResponsesEnabled)] += 1;
  }
  return counts;
}
