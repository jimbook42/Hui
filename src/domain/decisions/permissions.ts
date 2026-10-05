import { canManageEvent } from "@/domain/events/permissions";
import type { MembershipRole } from "@/domain/groups/permissions";
import type { EventStatus } from "@/domain/events/types";

export function canManageEventDecisions(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}

export function canRespondToEventDecisions(status: EventStatus): boolean {
  return status === "proposing" || status === "confirmed";
}
