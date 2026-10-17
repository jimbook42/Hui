import { participantRespondPath } from "@/lib/events/paths";

export type NotificationKind =
  | "event_proposed"
  | "consensus_ready"
  | "event_confirmed"
  | "event_cancelled"
  | "event_rescheduled"
  | "host_proposed"
  | "host_accepted"
  | "host_declined"
  | "contribution_changed"
  | "reconnect_reminder"
  | "proposal_deadline_reminder"
  | "stale_proposal_passed"
  | "stale_proposal_auto_cancelled"
  | "planning_cycle_opens"
  | "new_proposed_time";

export type MemberNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  groupId: string;
  eventId: string | null;
  readAt: string | null;
  createdAt: string;
  groupTimeZone: string;
};

const PARTICIPANT_RESPOND_KINDS = new Set<NotificationKind>([
  "event_proposed",
  "consensus_ready",
  "event_rescheduled",
  "proposal_deadline_reminder",
  "new_proposed_time",
]);

export function notificationHref(
  notification: Pick<MemberNotification, "eventId" | "groupId" | "kind">,
): string {
  if (notification.eventId) {
    if (PARTICIPANT_RESPOND_KINDS.has(notification.kind)) {
      return participantRespondPath(notification.eventId);
    }
    return `/events/${notification.eventId}`;
  }
  return `/groups/${notification.groupId}`;
}
