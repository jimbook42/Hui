import type { AvailabilityChoice } from "@/domain/scheduling/types";

export function availabilityLabel(choice: AvailabilityChoice): string {
  switch (choice) {
    case "available":
      return "Available";
    case "unavailable":
      return "Unavailable";
    case "maybe":
      return "Maybe";
  }
}
