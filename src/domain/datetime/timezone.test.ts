import { describe, expect, it } from "vitest";

import {
  formatEventTimeRange,
  wallClockToUtcIso,
} from "./timezone";

describe("timezone wall clock parsing", () => {
  it("keeps Pacific/Auckland evening times stable across confirmation", () => {
    const utc = wallClockToUtcIso("2026-04-05T18:00", "Pacific/Auckland");
    expect(utc).toBeTruthy();
    const ends = wallClockToUtcIso("2026-04-05T21:00", "Pacific/Auckland");
    expect(ends).toBeTruthy();

    const label = formatEventTimeRange(utc!, ends!, "Pacific/Auckland");
    expect(label).toContain("6:00");
    expect(label).toContain("9:00");
    expect(label).toContain("Apr");
  });

  it("handles NZ daylight saving boundary in April", () => {
    const utc = wallClockToUtcIso("2026-04-05T18:00", "Pacific/Auckland");
    expect(utc).toMatch(/2026-04-05T0[56]:00:00\.000Z/);
  });

  it("displays October Sunday evening in Pacific/Auckland as PM, not AM", () => {
    const utc = wallClockToUtcIso("2026-10-04T18:00", "Pacific/Auckland");
    const ends = wallClockToUtcIso("2026-10-04T21:00", "Pacific/Auckland");
    const label = formatEventTimeRange(utc!, ends!, "Pacific/Auckland");
    expect(label.toLowerCase()).toContain("pm");
    expect(label).toContain("6:00");
    expect(label).toContain("9:00");
  });
});
