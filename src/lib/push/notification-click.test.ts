import { describe, expect, it } from "vitest";

import { openNotificationDestination, type NotificationWindowClient } from "./notification-click";
import { pushEventDisplay } from "./payload";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "33333333-3333-4333-8333-333333333333";

describe("service worker push handling", () => {
  it("displays a received push notification", () => {
    const display = pushEventDisplay({
      notificationId: NOTE_ID,
      title: "Event confirmed",
      body: "Dinner is confirmed.",
      url: `/events/${EVENT_ID}`,
    });
    expect(display.title).toBe("Event confirmed");
    expect(display.options.body).toBe("Dinner is confirmed.");
    expect(display.options.data.url).toBe(`/events/${EVENT_ID}`);
  });

  it("focuses an open Hui window on the notification destination", async () => {
    const navigated: string[] = [];
    const client: NotificationWindowClient = {
      url: "https://hui.example/dashboard",
      focus: async () => undefined,
      navigate: async (url: string) => {
        navigated.push(url);
      },
    };
    const result = await openNotificationDestination(
      {
        matchAll: async () => [client],
        openWindow: async () => {
          throw new Error("should reuse the open window");
        },
      },
      "https://hui.example",
      `/events/${EVENT_ID}#contributions`,
    );
    expect(result).toBe("navigated");
    expect(navigated).toEqual([`https://hui.example/events/${EVENT_ID}#contributions`]);
  });

  it("opens a new window when no Hui client is available", async () => {
    const opened: string[] = [];
    const result = await openNotificationDestination(
      {
        matchAll: async () => [],
        openWindow: async (url: string) => {
          opened.push(url);
        },
      },
      "https://hui.example",
      "https://evil.example",
    );
    expect(result).toBe("opened");
    expect(opened).toEqual(["https://hui.example/notifications"]);
  });
});
