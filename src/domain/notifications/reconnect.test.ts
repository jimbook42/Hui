import { describe, expect, it } from "vitest";

import {
  groupLastActivityAt,
  isReconnectReminderDue,
  reconnectDedupeKey,
} from "./reconnect";

describe("reconnect reminders", () => {
  it("uses the latest non-cancelled event activity", () => {
    const last = groupLastActivityAt(
      ["2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"],
      "2025-12-01T00:00:00Z",
    );
    expect(last.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("falls back to group creation when there are no events", () => {
    const last = groupLastActivityAt([], "2025-12-01T00:00:00Z");
    expect(last.toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });

  it("detects inactivity after the configured day count", () => {
    const last = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-15T00:00:00Z");
    expect(isReconnectReminderDue(last, 14, now)).toBe(true);
    expect(isReconnectReminderDue(last, 20, now)).toBe(false);
  });

  it("builds a stable dedupe key from last activity date", () => {
    expect(
      reconnectDedupeKey("abc", new Date("2026-03-04T12:00:00Z")),
    ).toBe("reconnect:abc:2026-03-04");
  });
});
