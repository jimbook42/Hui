import type { AvailabilityChoice } from "@/domain/scheduling/types";

export function participantAttendanceShortLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "yes";
    case "maybe":
      return "maybe";
    case "unavailable":
      return "no";
  }
}

/** Brief toast after saving an answer in the respond flow. */
export function participantSaveToastMessage(
  choice: AvailabilityChoice,
  timeLabel: string,
): string {
  void choice;
  void timeLabel;
  return "Saved";
}

export function participantDoneToastMessage(): string {
  return "Saved";
}
