"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markNotificationReadByIdAction } from "@/app/notifications/actions";
import { huiButtonClass } from "@/components/hui/hui-button";
import { notificationHref, type MemberNotification } from "@/lib/notifications/types";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";

type OpenNotificationButtonProps = {
  notification: MemberNotification;
  label?: string;
  variant?: "primary" | "soft";
};

export function OpenNotificationButton({
  notification,
  label = "Open",
  variant = "soft",
}: OpenNotificationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = notificationHref(notification);

  return (
    <button
      type="button"
      disabled={pending}
      className={huiButtonClass({ variant, size: "sm", shape: "melt", className: "shrink-0" })}
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
      {pending ? "Opening…" : label}
    </button>
  );
}
