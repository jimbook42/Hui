import {
  canManageEvent,
  canProposeEvents,
} from "@/domain/events/permissions";
import { assertMetadataEditable } from "@/domain/events/lifecycle";
import type { EventStatus } from "@/domain/events/types";
import { TERMINAL_EVENT_STATUSES } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";
import type { GroupSettingsRow } from "@/lib/groups/types";

export function canAddCandidates(
  viewerRole: MembershipRole,
  settings: GroupSettingsRow,
  status: EventStatus,
): boolean {
  if (TERMINAL_EVENT_STATUSES.includes(status)) {
    return false;
  }
  if (assertMetadataEditable(status)) {
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
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}

export function canRespondToCandidates(status: EventStatus): boolean {
  if (TERMINAL_EVENT_STATUSES.includes(status)) {
    return false;
  }
  return assertMetadataEditable(status) === null;
}
