import { describe, expect, it } from "vitest";

import { eventAttentionPath, eventManagePath, participantRespondPath } from "./paths";

describe("event paths (HUI-026B)", () => {
  it("builds the participant respond route", () => {
    expect(participantRespondPath("abc-123")).toBe("/events/abc-123/respond");
  });

  it("builds the manage route (HUI-026D)", () => {
    expect(eventManagePath("abc-123")).toBe("/events/abc-123/manage");
  });

  it("builds attention deep links for home cards", () => {
    expect(eventAttentionPath("abc-123", "confirm")).toBe("/events/abc-123#scheduling");
    expect(eventAttentionPath("abc-123", "contribute")).toBe("/events/abc-123#contributions");
  });
});
