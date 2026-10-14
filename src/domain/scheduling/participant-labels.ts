import type { AvailabilityChoice } from "./types";

/** Invitee task flow labels — short and consistent across the respond flow. */
export function participantAttendanceChoiceLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Yes";
    case "maybe":
      return "Maybe";
    case "unavailable":
      return "No";
  }
}

export function participantAttendanceSummaryLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Yes";
    case "maybe":
      return "Maybe";
    case "unavailable":
      return "No";
  }
}
