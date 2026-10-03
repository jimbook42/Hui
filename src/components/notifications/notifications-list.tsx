import { markAllNotificationsReadFormAction } from "@/app/notifications/actions";
import { OpenNotificationButton } from "@/components/notifications/open-notification-button";
import { formatInstantInTimeZone } from "@/domain/datetime/timezone";
import { type MemberNotification } from "@/lib/notifications/types";

type NotificationsListProps = {
  notifications: MemberNotification[];
};

export function NotificationsList({ notifications }: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No notifications yet. When something needs your attention in a group, it will
        appear here.
      </p>
    );
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      {unreadCount > 0 ? (
        <form action={markAllNotificationsReadFormAction}>
          <button
            type="submit"
            className="text-sm text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Mark all as read ({unreadCount})
          </button>
        </form>
      ) : null}

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {notifications.map((notification) => {
          const unread = !notification.readAt;
          return (
            <li
              key={notification.id}
              className={
                unread
                  ? "bg-sky-50/80 px-4 py-4 dark:bg-sky-950/30"
                  : "px-4 py-4"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {notification.title}
                    {unread ? (
                      <span className="ml-2 inline-block rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
                        New
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {notification.body}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {formatInstantInTimeZone(notification.createdAt, notification.groupTimeZone, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <OpenNotificationButton notification={notification} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
