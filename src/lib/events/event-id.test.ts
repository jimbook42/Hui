import { describe, expect, it } from "vitest";

import { isEventId } from "@/lib/events/event-id";

describe("isEventId", () => {
  it("accepts canonical UUIDs", () => {
    expect(isEventId("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isEventId("7a8a541c-98e4-4a2f-baa9-5b0f820d2eef")).toBe(true);
  });

  it("rejects malformed route segments", () => {
    expect(isEventId("not-a-uuid")).toBe(false);
    expect(isEventId("")).toBe(false);
  });
});
