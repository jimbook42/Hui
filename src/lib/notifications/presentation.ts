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
  event_cancelled: {
    label: "Cancelled",
    tone: "clay",
    icon: "calendar",
    actionLabel: "View",
    actionable: false,
  },
  event_rescheduled: {
    label: "Time changed",
    tone: "clay",
    icon: "calendar",
    actionLabel: "Reply",
    actionable: true,
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
  proposal_deadline_reminder: {
    label: "Needs a reply",
    tone: "blue",
    icon: "spark",
    actionLabel: "Reply",
    actionable: true,
  },
  stale_proposal_passed: {
    label: "Proposal date passed",
    tone: "clay",
    icon: "calendar",
    actionLabel: "View",
    actionable: false,
  },
  stale_proposal_auto_cancelled: {
    label: "Proposal cancelled",
    tone: "clay",
    icon: "calendar",
    actionLabel: "View",
    actionable: false,
  },
  planning_cycle_opens: {
    label: "Planning open",
    tone: "blue",
    icon: "spark",
    actionLabel: "View group",
    actionable: false,
  },
};

const FALLBACK_PRESENTATION: NotificationPresentation = {
  label: "Update",
  tone: "neutral",
  icon: "spark",
  actionLabel: "View",
  actionable: false,
};

export function notificationPresentation(kind: NotificationKind | string): NotificationPresentation {
  return PRESENTATION[kind as NotificationKind] ?? FALLBACK_PRESENTATION;
}

const LEGACY_NOTIFICATION_TITLES: Record<string, string> = {
  "Contribution updated": "What to bring updated",
};

/** User-facing notification title (maps legacy DB copy to current product language). */
export function displayNotificationTitle(title: string): string {
  return LEGACY_NOTIFICATION_TITLES[title] ?? title;
}
