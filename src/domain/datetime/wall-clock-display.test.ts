import { describe, expect, it } from "vitest";

import {
  formatWallClockDateLabel,
  formatWallClockTimeLabel,
  formatWallClockTimeRangeLabel,
} from "@/domain/datetime/wall-clock-display";

describe("wall-clock display labels", () => {
  it("formats yyyy-MM-dd for NZ locale", () => {
    const label = formatWallClockDateLabel("2026-10-31", "en-NZ");
    expect(label).toMatch(/Oct/);
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/31/);
  });

  it("rejects invalid calendar dates", () => {
    expect(formatWallClockDateLabel("2026-02-30")).toBeNull();
    expect(formatWallClockDateLabel("not-a-date")).toBeNull();
  });

  it("formats HH:mm as 12-hour time", () => {
    expect(formatWallClockTimeLabel("12:00", "en-NZ")).toMatch(/12:00/i);
    expect(formatWallClockTimeLabel("15:00", "en-NZ")).toMatch(/3:00/i);
  });

  it("formats a wall-clock time range", () => {
    const range = formatWallClockTimeRangeLabel("12:00", "15:00", "en-NZ");
    expect(range).toMatch(/12:00/i);
    expect(range).toMatch(/3:00/i);
    expect(range).toContain("–");
  });
});
