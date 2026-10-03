const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUSH_ELIGIBLE_KINDS = [
  "event_proposed",
  "consensus_ready",
  "event_confirmed",
  "host_proposed",
  "host_accepted",
  "host_declined",
  "contribution_changed",
] as const;

export type PushEligibleKind = (typeof PUSH_ELIGIBLE_KINDS)[number];

const ELIGIBLE = new Set<string>(PUSH_ELIGIBLE_KINDS);
const HOST_KINDS = new Set(["host_proposed", "host_accepted", "host_declined"]);

export const PUSH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type PushPayload = {
  notificationId: string;
  title: string;
  body: string;
  url: string;
};

export function isPushEligibleKind(kind: string): boolean {
  return ELIGIBLE.has(kind);
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function pushDeepLink(input: {
  kind: string;
  eventId: string | null;
  groupId: string;
}): string {
  if (!isUuid(input.groupId)) {
    return "/notifications";
  }
  if (isUuid(input.eventId)) {
    const base = `/events/${input.eventId}`;
    if (input.kind === "contribution_changed") {
      return `${base}#contributions`;
    }
    if (HOST_KINDS.has(input.kind)) {
      return `${base}#host`;
    }
    return base;
  }
  return `/groups/${input.groupId}`;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function buildPushPayload(input: {
  id: string;
  kind: string;
  title: string;
  body: string;
  eventId: string | null;
  groupId: string;
}): PushPayload | null {
  if (!isPushEligibleKind(input.kind) || !isUuid(input.id)) {
    return null;
  }
  const title = clip(input.title, 120);
  const body = clip(input.body, 180);
  if (!title || !body) {
    return null;
  }
  const url = pushDeepLink(input);
  return {
    notificationId: input.id,
    title,
    body,
    url,
  };
}

export type PushPlanReason = "ok" | "ineligible_kind" | "push_disabled" | "expired" | "invalid";

export function planPushDelivery(input: {
  id: string;
  kind: string;
  title: string;
  body: string;
  eventId: string | null;
  groupId: string;
  webPushEnabled: boolean;
  createdAt: string;
  now?: Date;
}): { reason: PushPlanReason; payload: PushPayload | null } {
  if (!isPushEligibleKind(input.kind)) {
    return { reason: "ineligible_kind", payload: null };
  }
  if (!input.webPushEnabled) {
    return { reason: "push_disabled", payload: null };
  }
  const created = Date.parse(input.createdAt);
  const now = input.now ?? new Date();
  if (!Number.isFinite(created) || now.getTime() - created > PUSH_MAX_AGE_MS) {
    return { reason: "expired", payload: null };
  }
  const payload = buildPushPayload(input);
  if (!payload) {
    return { reason: "invalid", payload: null };
  }
  return { reason: "ok", payload };
}

export function parsePushPayload(raw: unknown): PushPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const notificationId = record.notificationId;
  const title = record.title;
  const body = record.body;
  const url = record.url;
  if (
    typeof notificationId !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    typeof url !== "string"
  ) {
    return null;
  }
  const safeUrl = notificationClickPath(url);
  const safeTitle = clip(title, 120);
  const safeBody = clip(body, 180);
  if (!safeTitle || !safeBody || !isUuid(notificationId)) {
    return null;
  }
  return {
    notificationId,
    title: safeTitle,
    body: safeBody,
    url: safeUrl,
  };
}

export function notificationClickPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > 300) {
    return "/notifications";
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return "/notifications";
  }
  if (/\s/.test(raw)) {
    return "/notifications";
  }
  try {
    const url = new URL(raw, "https://hui.local");
    if (url.origin !== "https://hui.local") {
      return "/notifications";
    }
    return `${url.pathname}${url.search}${url.hash}` || "/notifications";
  } catch {
    return "/notifications";
  }
}

export type PushDisplay = {
  title: string;
  options: {
    body: string;
    tag: string;
    icon: string;
    data: { url: string; notificationId: string };
  };
};

export function pushEventDisplay(raw: unknown): PushDisplay {
  const payload = parsePushPayload(raw);
  if (!payload) {
    return {
      title: "Hui",
      options: {
        body: "You have a new notification.",
        tag: "hui-notification",
        icon: "/icons/icon-192.png",
        data: { url: "/notifications", notificationId: "" },
      },
    };
  }
  return {
    title: payload.title,
    options: {
      body: payload.body,
      tag: payload.notificationId,
      icon: "/icons/icon-192.png",
      data: { url: payload.url, notificationId: payload.notificationId },
    },
  };
}
