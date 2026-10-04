import type { ReactNode } from "react";

import { markAllNotificationsReadFormAction } from "@/app/notifications/actions";
import { EmptyState } from "@/components/hui/empty-state";
import {
  BowlIcon,
  CalendarIcon,
  CheckIcon,
  PeopleIcon,
  SparkIcon,
  UserIcon,
} from "@/components/hui/icons";
import { SectionHeader } from "@/components/hui/section-header";
import { OpenNotificationButton } from "@/components/notifications/open-notification-button";
import { formatInstantInTimeZone } from "@/domain/datetime/timezone";
import {
  notificationPresentation,
  type NotificationIconKey,
  type NotificationTone,
} from "@/lib/notifications/presentation";
import { type MemberNotification } from "@/lib/notifications/types";
import { cn } from "@/lib/ui/cn";

type NotificationsListProps = {
  notifications: MemberNotification[];
};

const ICONS: Record<NotificationIconKey, ReactNode> = {
  spark: <SparkIcon size={22} />,
  calendar: <CalendarIcon size={22} />,
  check: <CheckIcon size={22} strokeWidth={2.6} />,
  host: <UserIcon size={22} />,
  bowl: <BowlIcon size={22} />,
  people: <PeopleIcon size={22} />,
};

const TONE_BLOB: Record<NotificationTone, string> = {
  blue: "bg-[var(--blob-blue)]",
  sage: "bg-[var(--blob-sage)]",
  clay: "bg-[var(--blob-clay)]",
  neutral: "bg-muted",
};

function NotificationCard({ notification }: { notification: MemberNotification }) {
  const unread = !notification.readAt;
  const presentation = notificationPresentation(notification.kind);

  return (
    <li>
      <article
        className={cn(
          "flex gap-4 p-5",
          unread
            ? "hui-shape-organic-alt bg-surface hui-shadow-md"
            : "rounded-hui-xl bg-muted",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "hui-shape-blob-a flex h-12 w-12 shrink-0 items-center justify-center text-foreground",
            TONE_BLOB[presentation.tone],
          )}
        >
          {ICONS[presentation.icon]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="hui-type-label text-accent">{presentation.label}</p>
            {unread ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-clay-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--accent-clay)]" />
                New
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-[1.0625rem] font-extrabold leading-snug text-foreground">
            {notification.title}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-snug text-muted-foreground">
            {notification.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-muted-foreground">
              {formatInstantInTimeZone(notification.createdAt, notification.groupTimeZone, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <OpenNotificationButton
              notification={notification}
              label={presentation.actionLabel}
              variant={unread && presentation.actionable ? "primary" : "soft"}
            />
          </div>
        </div>
      </article>
    </li>
  );
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="All quiet"
        description="When something needs your attention in a group, it will appear here. Private availability and dietary details stay private."
      />
    );
  }

  const unread = notifications.filter((n) => !n.readAt);
  const earlier = notifications.filter((n) => n.readAt);

  return (
    <div className="space-y-8">
      {unread.length > 0 ? (
        <section aria-labelledby="notifications-new" className="space-y-4">
          <SectionHeader
            id="notifications-new"
            title="New"
            action={
              <form action={markAllNotificationsReadFormAction}>
                <button
                  type="submit"
                  className="hui-link hui-focus-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm"
                >
                  Mark all read ({unread.length})
                </button>
              </form>
            }
          />
          <ul className="space-y-4">
            {unread.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </ul>
        </section>
      ) : null}

      {earlier.length > 0 ? (
        <section aria-labelledby="notifications-earlier" className="space-y-4">
          <SectionHeader id="notifications-earlier" title="Earlier" />
          <ul className="space-y-3">
            {earlier.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
