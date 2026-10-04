import { markAllNotificationsReadFormAction } from "@/app/notifications/actions";
import { OpenNotificationButton } from "@/components/notifications/open-notification-button";
import { EmptyState } from "@/components/hui/empty-state";
import { HuiSurface } from "@/components/hui/hui-surface";
import { StatusPill } from "@/components/hui/status-pill";
import { formatInstantInTimeZone } from "@/domain/datetime/timezone";
import { type MemberNotification } from "@/lib/notifications/types";

type NotificationsListProps = {
  notifications: MemberNotification[];
};

export function NotificationsList({ notifications }: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="All quiet"
        description="When something needs your attention in a group, it will appear here. Private availability and dietary details stay private."
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <form action={markAllNotificationsReadFormAction}>
          <button
            type="submit"
            className="hui-focus-ring hui-type-body text-primary underline-offset-4 hover:underline"
          >
            Mark all as read ({unreadCount})
          </button>
        </form>
      ) : null}

      <ul className="space-y-2">
        {notifications.map((notification) => {
          const unread = !notification.readAt;
          return (
            <li key={notification.id}>
              <HuiSurface
                padding="sm"
                className={unread ? "border-primary/30 bg-secondary/40" : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="hui-type-body font-medium text-foreground">
                      {notification.title}
                      {unread ? (
                        <StatusPill label="New" tone="active" className="ml-2 align-middle" />
                      ) : null}
                    </p>
                    <p className="mt-1 hui-type-supporting">{notification.body}</p>
                    <p className="mt-2 hui-type-label text-muted-foreground">
                      {formatInstantInTimeZone(notification.createdAt, notification.groupTimeZone, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <OpenNotificationButton notification={notification} />
                </div>
              </HuiSurface>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
