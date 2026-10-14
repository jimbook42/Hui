import type { AvailabilityChoice } from "./types";

/** Invitee task flow labels — short and consistent across the respond flow. */
export function participantAttendanceChoiceLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Yes";
    case "maybe":
      return "Maybe";
    case "unavailable":
      return "Can't";
  }
}

export function participantAttendanceSummaryLabel(
  choice: AvailabilityChoice,
  options?: { confirmed?: boolean },
): string {
  switch (choice) {
    case "available":
      return options?.confirmed ? "You're in" : "Yes";
    case "maybe":
      return "Maybe";
    case "unavailable":
      return "Can't";
  }
}
