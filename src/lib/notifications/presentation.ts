import type { NotificationKind } from "@/lib/notifications/types";

export type NotificationIconKey = "spark" | "calendar" | "check" | "host" | "bowl" | "people";
export type NotificationTone = "blue" | "sage" | "clay" | "neutral";

export type NotificationPresentation = {
  /** Short category shown above the title ("Needs a reply"). */
  label: string;
  tone: NotificationTone;
  icon: NotificationIconKey;
  /** What tapping the primary action does, in the user's words. */
  actionLabel: string;
  /** True when the notification is asking the member to do something. */
  actionable: boolean;
};

const PRESENTATION: Record<NotificationKind, NotificationPresentation> = {
  event_proposed: {
    label: "New hui",
    tone: "blue",
    icon: "spark",
    actionLabel: "Reply",
    actionable: true,
  },
  consensus_ready: {
    label: "A time works",
    tone: "sage",
    icon: "calendar",
    actionLabel: "Reply",
    actionable: true,
  },
  event_confirmed: {
    label: "Confirmed",
    tone: "sage",
    icon: "check",
    actionLabel: "See details",
    actionable: false,
  },
  host_proposed: {
    label: "Hosting request",
    tone: "clay",
    icon: "host",
    actionLabel: "Respond",
    actionable: true,
  },
  host_accepted: {
    label: "Host settled",
    tone: "neutral",
    icon: "host",
    actionLabel: "View",
    actionable: false,
  },
  host_declined: {
    label: "Host update",
    tone: "clay",
    icon: "host",
    actionLabel: "View",
    actionable: false,
  },
  contribution_changed: {
    label: "What to bring",
    tone: "neutral",
    icon: "bowl",
    actionLabel: "View",
    actionable: false,
  },
  reconnect_reminder: {
    label: "Time to catch up",
    tone: "clay",
    icon: "people",
    actionLabel: "View group",
    actionable: false,
  },
};

export function notificationPresentation(kind: NotificationKind): NotificationPresentation {
  return PRESENTATION[kind];
}
