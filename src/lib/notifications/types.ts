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

export function notificationHref(notification: Pick<MemberNotification, "eventId" | "groupId">): string {
  if (notification.eventId) {
    return `/events/${notification.eventId}`;
  }
  return `/groups/${notification.groupId}`;
}
