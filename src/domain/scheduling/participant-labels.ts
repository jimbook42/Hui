import type { AvailabilityChoice } from "./types";

/** Invitee task flow labels — not the coordination-page availability vocabulary. */
export function participantAttendanceChoiceLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Yes, I can come";
    case "maybe":
      return "Maybe, I can make it work";
    case "unavailable":
      return "No, I can't come";
  }
}

export function participantAttendanceSummaryLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Can come";
    case "maybe":
      return "Can make it work";
    case "unavailable":
      return "Can't come";
  }
}
