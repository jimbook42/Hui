import type { ConsensusFailureReason, ConsensusRule } from "@/domain/scheduling/consensus";
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

export function consensusRuleLabel(rule: ConsensusRule): string {
  switch (rule) {
    case "required_participants":
      return "Required participants";
    case "minimum_attendees":
      return "Minimum attendees";
    case "all_active_members":
      return "All active members";
  }
}

export function consensusFailureLabel(
  reason: ConsensusFailureReason | "candidate_not_active",
  counts: { acceptedCount: number; minimumAttendees: number },
): string {
  switch (reason) {
    case "below_minimum_attendees":
      return `Needs at least ${counts.minimumAttendees} available (currently ${counts.acceptedCount}).`;
    case "required_participants":
      return "Not every required participant is available.";
    case "all_active_members":
      return "Not every current member is available.";
    case "candidate_not_active":
      return "This time is no longer active.";
  }
}
