"use client";

import { useState, useTransition } from "react";

import { loadMoreNotificationsAction } from "@/app/notifications/actions";
import { NotificationsList } from "@/components/notifications/notifications-list";
import type { MemberNotification } from "@/lib/notifications/types";

type NotificationsListPaginatedProps = {
  initialNotifications: MemberNotification[];
  initialHasMore: boolean;
};

export function NotificationsListPaginated({
  initialNotifications,
  initialHasMore,
}: NotificationsListPaginatedProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await loadMoreNotificationsAction(notifications.length);
      if (result.error) {
        return;
      }
      setNotifications((prev) => [...prev, ...result.notifications]);
      setHasMore(result.hasMore);
    });
  }

  return (
    <div className="space-y-6">
      <NotificationsList notifications={notifications} />
      {hasMore ? (
        <button
          type="button"
          disabled={pending}
          onClick={loadMore}
          className="hui-btn hui-btn-secondary rounded-full hui-focus-ring w-full"
        >
          {pending ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
