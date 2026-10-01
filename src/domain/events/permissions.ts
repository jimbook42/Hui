import type { MembershipRole } from "@/domain/groups/permissions";
import type { GroupSettingsRow } from "@/lib/groups/types";

import type { EventKind, EventStatus } from "./types";
import { TERMINAL_EVENT_STATUSES } from "./types";

export function canProposeEvents(
  role: MembershipRole,
  settings: GroupSettingsRow,
): boolean {
  if (settings.whoMayPropose === "admins_only") {
    return role === "owner" || role === "admin";
  }
  return true;
}

export function groupAllowsEventKind(
  kind: EventKind,
  settings: GroupSettingsRow,
): boolean {
  if (kind === "one_off") {
    return settings.oneOffEventsAllowed;
  }
  return settings.recurringEventsEnabled;
}

export function canManageEvent(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  if (TERMINAL_EVENT_STATUSES.includes(status)) {
    return false;
  }
  if (viewerRole === "owner" || viewerRole === "admin") {
    return true;
  }
  return viewerId === createdBy;
}

export function canEditEventMetadata(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}

export function canCancelEvent(
  viewerRole: MembershipRole,
  viewerId: string,
  createdBy: string,
  status: EventStatus,
): boolean {
  if (status === "cancelled" || status === "completed") {
    return false;
  }
  return canManageEvent(viewerRole, viewerId, createdBy, status);
}
