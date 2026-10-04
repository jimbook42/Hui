"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markNotificationReadByIdAction } from "@/app/notifications/actions";
import { notificationHref, type MemberNotification } from "@/lib/notifications/types";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";

type OpenNotificationButtonProps = {
  notification: MemberNotification;
};

export function OpenNotificationButton({ notification }: OpenNotificationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = notificationHref(notification);

  return (
    <button
      type="button"
      disabled={pending}
      className="shrink-0 text-sm font-medium text-sky-700 underline-offset-4 hover:underline disabled:opacity-60 dark:text-sky-400"
      onClick={() => {
        beginInteraction("notification_open");
        markInteraction("notification_open", "handler-start");
        markInteraction("notification_open", "navigation-start");
        startTransition(() => {
          router.push(href);
          markInteraction("notification_open", "optimistic-ui-visible");
        });
        void markNotificationReadByIdAction(notification.id).finally(() => {
          markInteraction("notification_open", "request-end");
          endInteraction("notification_open");
        });
      }}
    >
      {pending ? "Opening…" : "Open"}
    </button>
  );
}
