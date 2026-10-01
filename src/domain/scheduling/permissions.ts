import { assertCanFinalise, isSchedulingOpen } from "@/domain/events/lifecycle";
import {
  canManageEvent,
  canProposeEvents,
} from "@/domain/events/permissions";
import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";
import type { GroupSettingsRow } from "@/lib/groups/types";

export function canAddCandidates(
  viewerRole: MembershipRole,
  settings: GroupSettingsRow,
  status: EventStatus,
): boolean {
  if (!isSchedulingOpen(status)) {
    return false;
  }
  return canProposeEvents(viewerRole, settings);
}

export function canWithdrawCandidate(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  if (!isSchedulingOpen(status)) {
    return false;
  }
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}

export function canRespondToCandidates(status: EventStatus): boolean {
  return isSchedulingOpen(status);
}

export function canFinaliseEvent(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  if (assertCanFinalise(status)) {
    return false;
  }
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}
