import { describe, expect, it } from "vitest";

import { notificationHref } from "@/lib/notifications/types";

import {
  buildPushPayload,
  notificationClickPath,
  planPushDelivery,
  pushDeepLink,
  pushEventDisplay,
} from "./payload";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const NOTE_ID = "33333333-3333-4333-8333-333333333333";

const base = {
  id: NOTE_ID,
  title: "New event proposal",
  body: "Potluck was proposed in Family.",
  eventId: EVENT_ID,
  groupId: GROUP_ID,
  webPushEnabled: true,
  createdAt: "2026-10-03T10:00:00.000Z",
  now: new Date("2026-10-03T10:05:00.000Z"),
};

describe("push payload", () => {
  it("builds a minimal deep link for an eligible notification", () => {
    const payload = buildPushPayload({ ...base, kind: "event_proposed" });
    expect(payload).toEqual({
      notificationId: NOTE_ID,
      title: "New event proposal",
      body: "Potluck was proposed in Family.",
      url: `/events/${EVENT_ID}/respond`,
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(["body", "notificationId", "title", "url"]);
    expect(
      payload?.url.startsWith(
        notificationHref({ eventId: EVENT_ID, groupId: GROUP_ID, kind: "event_proposed" }),
      ),
    ).toBe(true);
  });

  it("does not copy private attendance or dietary fields into the payload", () => {
    const payload = buildPushPayload({
      ...base,
      kind: "event_confirmed",
      privateNote: "allergic to peanuts — do not share",
      dietary: "private requirement",
      reason: "can't come because of a private appointment",
    } as never);
    const encoded = JSON.stringify(payload);
    expect(encoded).not.toContain("peanuts");
    expect(encoded).not.toContain("private requirement");
    expect(encoded).not.toContain("appointment");
    expect(encoded).not.toContain("privateNote");
  });

  it("links host and contribution notifications to the matching section", () => {
    expect(pushDeepLink({ kind: "host_proposed", eventId: EVENT_ID, groupId: GROUP_ID })).toBe(
      `/events/${EVENT_ID}#host`,
    );
    expect(
      pushDeepLink({ kind: "contribution_changed", eventId: EVENT_ID, groupId: GROUP_ID }),
    ).toBe(`/events/${EVENT_ID}#contributions`);
    expect(pushDeepLink({ kind: "reconnect_reminder", eventId: null, groupId: GROUP_ID })).toBe(
      `/groups/${GROUP_ID}`,
    );
  });

  it("skips push when the kind is ineligible or the account preference is off", () => {
    expect(planPushDelivery({ ...base, kind: "reconnect_reminder" }).reason).toBe("ineligible_kind");
    expect(planPushDelivery({ ...base, kind: "event_proposed", webPushEnabled: false }).reason).toBe(
      "push_disabled",
    );
    expect(planPushDelivery({ ...base, kind: "event_confirmed" }).reason).toBe("ok");
  });

  it("does not deliver an expired notification", () => {
    expect(
      planPushDelivery({
        ...base,
        kind: "event_proposed",
        now: new Date("2026-10-03T18:00:00.000Z"),
      }).reason,
    ).toBe("expired");
  });

  it("opens only same-app paths from a notification click", () => {
    expect(notificationClickPath(`/events/${EVENT_ID}#host`)).toBe(`/events/${EVENT_ID}#host`);
    expect(notificationClickPath("https://evil.example/phish")).toBe("/notifications");
    expect(notificationClickPath("//evil.example")).toBe("/notifications");
  });

  it("displays the push title and destination without extra fields", () => {
    const display = pushEventDisplay({
      notificationId: NOTE_ID,
      title: "Host request",
      body: "You have been asked to host.",
      url: `/events/${EVENT_ID}#host`,
      privateNote: "secret",
    });
    expect(display.title).toBe("Host request");
    expect(display.options.body).toBe("You have been asked to host.");
    expect(display.options.data.url).toBe(`/events/${EVENT_ID}#host`);
    expect(JSON.stringify(display)).not.toContain("secret");
  });

  it("uses the colour app icon and the monochrome notification badge", () => {
    const display = pushEventDisplay({
      notificationId: NOTE_ID,
      title: "Host request",
      body: "You have been asked to host.",
      url: "/notifications",
    });
    expect(display.options.icon).toBe("/icons/icon-192.png");
    expect(display.options.badge).toBe("/icons/notification-badge-96.png");
  });
});
