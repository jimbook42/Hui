import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";

import type { HostAssignmentSnapshot } from "./types";

export function canAssignEventHost(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  eventStatus: EventStatus,
): boolean {
  if (eventStatus !== "confirmed") {
    return false;
  }
  if (viewerRole === "owner" || viewerRole === "admin") {
    return true;
  }
  return viewerId === createdBy;
}

export function canRespondToHostProposal(
  viewerId: string,
  pendingProposal: HostAssignmentSnapshot | null,
  eventStatus: EventStatus,
): boolean {
  if (eventStatus !== "confirmed" || !pendingProposal) {
    return false;
  }
  return pendingProposal.userId === viewerId && pendingProposal.status === "proposed";
}

export function canViewHostCoordination(eventStatus: EventStatus): boolean {
  return eventStatus === "confirmed" || eventStatus === "completed" || eventStatus === "cancelled";
}
