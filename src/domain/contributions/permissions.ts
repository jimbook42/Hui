import type { EventStatus } from "@/domain/events/types";
import { TERMINAL_EVENT_STATUSES } from "@/domain/events/types";
import { canManageEvent } from "@/domain/events/permissions";
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

/** Event creator or group owner/admin may assign or reassign contributions. */
export function canAssignEventContributions(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  eventStatus: EventStatus,
): boolean {
  return (
    canCoordinateContributions(eventStatus) &&
    canManageEvent(viewerRole, viewerId, createdBy, eventStatus)
  );
}
