import type { EventStatus } from "@/domain/events/types";

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "proposing":
      return "Proposing";
    case "voting":
      return "Voting";
    case "awaiting_agreement":
      return "Awaiting agreement";
    case "confirmed":
      return "Confirmed";
    case "reopened":
      return "Reopened";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function eventKindLabel(kind: "one_off" | "recurring"): string {
  return kind === "one_off" ? "One-off" : "Recurring";
}
