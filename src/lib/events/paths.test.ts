import { describe, expect, it } from "vitest";

import { eventManagePath, participantRespondPath } from "./paths";

describe("event paths (HUI-026B)", () => {
  it("builds the participant respond route", () => {
    expect(participantRespondPath("abc-123")).toBe("/events/abc-123/respond");
  });

  it("builds the manage route (HUI-026D)", () => {
    expect(eventManagePath("abc-123")).toBe("/events/abc-123/manage");
  });
});
