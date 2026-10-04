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
