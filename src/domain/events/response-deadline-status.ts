import type { EventStatus } from "@/domain/events/types";

const OPEN_RESPONSE_DEADLINE_STATUSES = new Set<EventStatus>([
  "draft",
  "proposing",
  "voting",
  "awaiting_agreement",
  "reopened",
]);

export function eventAcceptsResponseDeadline(status: EventStatus): boolean {
  return OPEN_RESPONSE_DEADLINE_STATUSES.has(status);
}
