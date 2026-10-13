import { describe, expect, it } from "vitest";

import { deliverNotificationPush, type PushSender, type PushSubscriptionTarget } from "./deliver";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const NOTE_ID = "33333333-3333-4333-8333-333333333333";

function subscription(id: string): PushSubscriptionTarget {
  return {
    id,
    endpoint: `https://push.example.test/${id}`,
    p256dh: "B".repeat(40),
    authKey: "C".repeat(24),
  };
}

const notification = {
  id: NOTE_ID,
  kind: "event_proposed",
  title: "New event proposal",
  body: "Potluck was proposed.",
  eventId: EVENT_ID,
  groupId: GROUP_ID,
  webPushEnabled: true,
  createdAt: "2026-10-03T10:00:00.000Z",
  now: new Date("2026-10-03T10:05:00.000Z"),
};

describe("push delivery", () => {
  it("sends an eligible notification to every subscription", async () => {
    const seen: string[] = [];
    const sender: PushSender = async (target, payload) => {
      seen.push(target.id);
      expect(payload.url).toBe(`/events/${EVENT_ID}/respond`);
      expect(JSON.stringify(payload)).not.toContain("private");
    };
    const result = await deliverNotificationPush({
      ...notification,
      subscriptions: [subscription("phone"), subscription("desktop")],
      sender,
    });
    expect(result.status).toBe("sent");
    expect(seen).toEqual(["phone", "desktop"]);
    expect(result.removeSubscriptionIds).toEqual([]);
  });

  it("does not send when push is disabled or the kind is not eligible", async () => {
    const sender: PushSender = async () => {
      throw new Error("should not send");
    };
    const disabled = await deliverNotificationPush({
      ...notification,
      webPushEnabled: false,
      subscriptions: [subscription("phone")],
      sender,
    });
    expect(disabled.status).toBe("skipped");
    expect(disabled.detail).toBe("push_disabled");

    const reconnect = await deliverNotificationPush({
      ...notification,
      kind: "reconnect_reminder",
      subscriptions: [subscription("phone")],
      sender,
    });
    expect(reconnect.status).toBe("skipped");
    expect(reconnect.detail).toBe("ineligible_kind");
  });

  it("continues after one subscription fails and removes only stale ones", async () => {
    const sender: PushSender = async (target) => {
      if (target.id === "stale") {
        const error = new Error("gone");
        (error as Error & { statusCode: number }).statusCode = 410;
        throw error;
      }
      if (target.id === "retry") {
        const error = new Error("upstream");
        (error as Error & { statusCode: number }).statusCode = 500;
        throw error;
      }
    };
    const result = await deliverNotificationPush({
      ...notification,
      subscriptions: [subscription("stale"), subscription("retry"), subscription("ok")],
      sender,
    });
    expect(result.status).toBe("sent");
    expect(result.removeSubscriptionIds).toEqual(["stale"]);
  });

  it("removes invalid subscriptions without treating that as a retryable failure", async () => {
    const sender: PushSender = async () => {
      const error = new Error("missing");
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    };
    const result = await deliverNotificationPush({
      ...notification,
      subscriptions: [subscription("gone")],
      sender,
    });
    expect(result.status).toBe("skipped");
    expect(result.removeSubscriptionIds).toEqual(["gone"]);
  });
});
