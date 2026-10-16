import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";

export function canEditEventResponseDeadline(
  status: EventStatus,
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  acceptedHostUserId: string | null,
): boolean {
  if (!eventAcceptsResponseDeadline(status)) {
    return false;
  }
  if (viewerRole === "owner" || viewerRole === "admin") {
    return true;
  }
  if (viewerId === createdBy) {
    return true;
  }
  if (acceptedHostUserId && acceptedHostUserId === viewerId) {
    return true;
  }
  return false;
}

export function canNudgeEventAvailability(
  status: EventStatus,
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  acceptedHostUserId: string | null,
): boolean {
  if (status !== "proposing") {
    return false;
  }
  return canEditEventResponseDeadline(
    status,
    viewerRole,
    viewerId,
    createdBy,
    acceptedHostUserId,
  );
}

export function canAdminPickEventTime(
  status: EventStatus,
  viewerRole: MembershipRole,
): boolean {
  return status === "proposing" && viewerRole === "admin";
}
