import { describe, expect, it } from "vitest";

import {
  calendarDaysFrom,
  formatClockTime,
  formatDayAndTime,
  formatTimeSpan,
  relativeDayLabel,
} from "./display";

const TZ = "Pacific/Auckland";

describe("datetime display", () => {
  it("formats compact clock times", () => {
    // 2026-10-15 18:30 NZDT == 2026-10-15T05:30Z
    expect(formatClockTime("2026-10-15T05:30:00Z", TZ)).toBe("6:30pm");
  });

  it("formats a same-day span", () => {
    expect(formatTimeSpan("2026-10-15T05:30:00Z", "2026-10-15T08:00:00Z", TZ)).toBe(
      "6:30pm – 9:00pm",
    );
  });

  it("collapses a missing end", () => {
    expect(formatTimeSpan("2026-10-15T05:30:00Z", null, TZ)).toBe("6:30pm");
  });

  it("builds a one-line day and time", () => {
    expect(formatDayAndTime("2026-10-15T05:30:00Z", TZ)).toContain("6:30pm");
  });

  it("counts calendar days in the target zone", () => {
    const now = new Date("2026-10-15T00:00:00Z"); // 13:00 on the 15th in Auckland
    expect(calendarDaysFrom("2026-10-15T05:30:00Z", TZ, now)).toBe(0);
    expect(calendarDaysFrom("2026-10-16T05:30:00Z", TZ, now)).toBe(1);
  });

  it("labels relative days", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(relativeDayLabel("2026-10-15T05:30:00Z", TZ, now)).toBe("Today");
    expect(relativeDayLabel("2026-10-16T05:30:00Z", TZ, now)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-19T05:30:00Z", TZ, now)).toBe("In 4 days");
  });
});
