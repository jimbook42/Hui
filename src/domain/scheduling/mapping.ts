import type { AvailabilityChoice, DbResponseValue } from "./types";

export function availabilityToDbResponse(choice: AvailabilityChoice): DbResponseValue {
  switch (choice) {
    case "available":
      return "yes";
    case "unavailable":
      return "no";
    case "maybe":
      return "maybe";
  }
}

export function dbResponseToAvailability(value: DbResponseValue): AvailabilityChoice {
  switch (value) {
    case "yes":
      return "available";
    case "no":
      return "unavailable";
    case "maybe":
      return "maybe";
  }
}
