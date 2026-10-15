import { describe, expect, it } from "vitest";

import { shouldShowEventHeroTime } from "./event-hero-visibility";

describe("event hero time visibility", () => {
  it("shows time for confirmed and completed hui when startsAt is set", () => {
    expect(shouldShowEventHeroTime("confirmed", "2026-10-19T12:00:00.000Z")).toBe(true);
    expect(shouldShowEventHeroTime("completed", "2026-10-19T12:00:00.000Z")).toBe(true);
  });

  it("shows cancelled hui times as context when startsAt is set", () => {
    expect(shouldShowEventHeroTime("cancelled", "2026-10-19T12:00:00.000Z")).toBe(true);
  });

  it("hides time when startsAt is missing", () => {
    expect(shouldShowEventHeroTime("proposing", null)).toBe(false);
    expect(shouldShowEventHeroTime("cancelled", null)).toBe(false);
  });
});
