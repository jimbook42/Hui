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
  const answer = participantAttendanceShortLabel(choice);
  const trimmedTime = timeLabel.trim();
  if (!trimmedTime) {
    return `Saved: you're a ${answer}`;
  }
  return `Saved: you're a ${answer} for ${trimmedTime}`;
}
