import { describe, expect, it } from "vitest";

import { participantRespondPath } from "./paths";

describe("event paths (HUI-026B)", () => {
  it("builds the participant respond route", () => {
    expect(participantRespondPath("abc-123")).toBe("/events/abc-123/respond");
  });
});
