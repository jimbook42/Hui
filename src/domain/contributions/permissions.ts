import type { EventStatus } from "@/domain/events/types";
import { TERMINAL_EVENT_STATUSES } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";
import { canEditSettings } from "@/domain/groups/permissions";

export function canManageContributionCategories(role: MembershipRole): boolean {
  return canEditSettings(role);
}

/** Members may claim or adjust contributions while the event is still active. */
export function canCoordinateContributions(eventStatus: EventStatus): boolean {
  return !TERMINAL_EVENT_STATUSES.includes(eventStatus);
}

export function isProposedEvent(eventStatus: EventStatus): boolean {
  return eventStatus === "proposing" || eventStatus === "voting" || eventStatus === "awaiting_agreement" || eventStatus === "reopened" || eventStatus === "draft";
}
