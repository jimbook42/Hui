import { describe, expect, it } from "vitest";

import { notificationHref } from "./types";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

describe("notification href (HUI-026B)", () => {
  it("opens participant respond flow for response notifications", () => {
    expect(
      notificationHref({ kind: "event_proposed", eventId: EVENT_ID, groupId: GROUP_ID }),
    ).toBe(`/events/${EVENT_ID}/respond`);
    expect(
      notificationHref({ kind: "consensus_ready", eventId: EVENT_ID, groupId: GROUP_ID }),
    ).toBe(`/events/${EVENT_ID}/respond`);
  });

  it("keeps other event notifications on the event page", () => {
    expect(
      notificationHref({ kind: "event_confirmed", eventId: EVENT_ID, groupId: GROUP_ID }),
    ).toBe(`/events/${EVENT_ID}`);
  });
});
