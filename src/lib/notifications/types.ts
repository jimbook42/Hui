import { participantRespondPath } from "@/lib/events/paths";

export type NotificationKind =
  | "event_proposed"
  | "consensus_ready"
  | "event_confirmed"
  | "host_proposed"
  | "host_accepted"
  | "host_declined"
  | "contribution_changed"
  | "reconnect_reminder";

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
