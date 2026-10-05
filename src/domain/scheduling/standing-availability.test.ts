import { describe, expect, it } from "vitest";

import {
  inferStandingAvailabilityHint,
  parseHhmmToMinutes,
  type StandingAvailabilityWindow,
} from "./standing-availability";

function window(
  partial: Omit<StandingAvailabilityWindow, "id" | "groupId">,
): StandingAvailabilityWindow {
  return {
    id: "w1",
    groupId: "g1",
    ...partial,
  };
}

describe("standing availability", () => {
  it("parses HH:mm to minutes", () => {
    expect(parseHhmmToMinutes("17:30")).toBe(17 * 60 + 30);
    expect(parseHhmmToMinutes("bad")).toBeNull();
  });

  it("suggests available when a standing window overlaps the candidate", () => {
    const hint = inferStandingAvailabilityHint(
      [
        window({
          dayOfWeek: 5,
          startMinute: 17 * 60,
          endMinute: 22 * 60,
          kind: "usually_available",
        }),
      ],
      "2026-10-09T06:00:00.000Z",
      "2026-10-09T09:00:00.000Z",
      "Pacific/Auckland",
    );
    expect(hint?.suggestedChoice).toBe("available");
    expect(hint?.summary).toContain("Usually works");
  });

  it("prefers unavailable when both kinds overlap", () => {
    const hint = inferStandingAvailabilityHint(
      [
        window({
          dayOfWeek: 6,
          startMinute: 10 * 60,
          endMinute: 22 * 60,
          kind: "usually_available",
        }),
        window({
          dayOfWeek: 6,
          startMinute: 17 * 60,
          endMinute: 20 * 60,
          kind: "usually_unavailable",
        }),
      ],
      "2026-10-10T05:00:00.000Z",
      "2026-10-10T07:00:00.000Z",
      "Pacific/Auckland",
    );
    expect(hint?.suggestedChoice).toBe("unavailable");
  });

  it("returns null when no window matches", () => {
    const hint = inferStandingAvailabilityHint(
      [
        window({
          dayOfWeek: 1,
          startMinute: 0,
          endMinute: 1440,
          kind: "usually_available",
        }),
      ],
      "2026-10-10T05:00:00.000Z",
      null,
      "Pacific/Auckland",
    );
    expect(hint).toBeNull();
  });
});
