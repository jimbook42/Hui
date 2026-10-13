import { describe, expect, it } from "vitest";

import { buildEventHeroDateCopy, formatEventDateBadgeParts } from "./event-hero-dates";

const TZ = "Pacific/Auckland";

describe("event hero dates", () => {
  it("formats badge parts in en-NZ", () => {
    const parts = formatEventDateBadgeParts("2026-10-31T05:30:00.000Z", TZ);
    expect(parts?.day).toBeTruthy();
    expect(parts?.month).toMatch(/OCT/i);
  });

  it("builds a stable server copy snapshot", () => {
    const copy = buildEventHeroDateCopy({
      startsAt: "2026-10-31T05:30:00.000Z",
      endsAt: "2026-10-31T08:30:00.000Z",
      timeZone: TZ,
      showRelativeWhen: true,
    });
    expect(copy?.longDay).toContain("October");
    expect(copy?.timeSpan.length).toBeGreaterThan(3);
    expect(copy?.showRelativeWhen).toBe(true);
  });
});
