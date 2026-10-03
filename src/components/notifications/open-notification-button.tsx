"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markNotificationReadByIdAction } from "@/app/notifications/actions";
import { notificationHref, type MemberNotification } from "@/lib/notifications/types";

type OpenNotificationButtonProps = {
  notification: MemberNotification;
};

export function OpenNotificationButton({ notification }: OpenNotificationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="shrink-0 text-sm font-medium text-sky-700 underline-offset-4 hover:underline disabled:opacity-60 dark:text-sky-400"
      onClick={() => {
        startTransition(async () => {
          await markNotificationReadByIdAction(notification.id);
          router.push(notificationHref(notification));
        });
      }}
    >
      Open
    </button>
  );
}
