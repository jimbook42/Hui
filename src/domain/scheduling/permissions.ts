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

/**
 * Whether members can set or change their own Yes / Maybe / No. Open while the group is still
 * scheduling and, since HUI-026U.3, after confirmation too (plans change). Completed and
 * cancelled events are locked. Once confirmed only the selected time accepts responses; the
 * database enforces that as well.
 */
export function canRespondToCandidates(status: EventStatus): boolean {
  return isSchedulingOpen(status) || status === "confirmed";
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
