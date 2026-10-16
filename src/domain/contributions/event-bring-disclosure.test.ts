import { describe, expect, it } from "vitest";

import { contributionsDisclosureDefaultOpen } from "@/domain/contributions/event-bring-disclosure";

describe("contributionsDisclosureDefaultOpen", () => {
  it("opens for contribute attention", () => {
    expect(contributionsDisclosureDefaultOpen(true, true, false)).toBe(true);
  });

  it("opens for organisers when the group has no bring categories yet", () => {
    expect(contributionsDisclosureDefaultOpen(false, false, true)).toBe(true);
  });

  it("stays closed for members when categories exist and no attention", () => {
    expect(contributionsDisclosureDefaultOpen(false, true, false)).toBe(false);
  });
});
