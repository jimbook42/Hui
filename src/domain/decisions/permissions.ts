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

/** Any active member may pose a generic decision while the hui accepts responses. */
export function canCreateEventDecisions(status: EventStatus): boolean {
  return canRespondToEventDecisions(status);
}

export function canEditOwnEventDecisionDraft(
  viewerId: string,
  decisionCreatedBy: string,
  responseCount: number,
  decisionStatus: "open" | "decided" | "cancelled",
): boolean {
  if (decisionStatus !== "open" || responseCount > 0) {
    return false;
  }
  return viewerId === decisionCreatedBy;
}
