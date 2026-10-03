import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";

import { pickAcceptedHost, pickPendingHostProposal } from "./display";

import type { HostAssignmentSnapshot } from "./types";

const HOST_COORDINATION_STATUSES: EventStatus[] = ["proposing", "confirmed"];

export function canAssignEventHost(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  eventStatus: EventStatus,
): boolean {
  if (!HOST_COORDINATION_STATUSES.includes(eventStatus)) {
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
  if (!HOST_COORDINATION_STATUSES.includes(eventStatus) || !pendingProposal) {
    return false;
  }
  return pendingProposal.userId === viewerId && pendingProposal.status === "proposed";
}

export function canRequestHostSwap(
  viewerId: string,
  assignments: HostAssignmentSnapshot[],
  eventStatus: EventStatus,
): boolean {
  if (!HOST_COORDINATION_STATUSES.includes(eventStatus)) {
    return false;
  }
  const acceptedHost = pickAcceptedHost(assignments);
  if (acceptedHost?.userId === viewerId) {
    return true;
  }
  const pendingProposal = pickPendingHostProposal(assignments);
  return pendingProposal?.userId === viewerId && pendingProposal.status === "proposed";
}

export function canViewHostCoordination(eventStatus: EventStatus): boolean {
  return (
    eventStatus === "proposing" ||
    eventStatus === "confirmed" ||
    eventStatus === "completed" ||
    eventStatus === "cancelled"
  );
}
