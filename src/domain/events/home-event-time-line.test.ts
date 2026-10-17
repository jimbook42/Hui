import { describe, expect, it } from "vitest";

import { formatHomeEventTimeLine } from "@/domain/events/home-event-time-line";

const START = "2026-11-13T23:00:00.000Z";
const TZ = "Pacific/Auckland";

describe("formatHomeEventTimeLine", () => {
  it("describes the leading proposed time in plain language", () => {
    expect(
      formatHomeEventTimeLine({
        status: "proposing",
        startsAt: START,
        endsAt: null,
        timeZone: TZ,
        proposalDatePassed: false,
        leadingProposedTime: true,
        planning: true,
      }),
    ).toMatch(/Most popular time so far/);
    expect(
      formatHomeEventTimeLine({
        status: "proposing",
        startsAt: START,
        endsAt: null,
        timeZone: TZ,
        proposalDatePassed: false,
        leadingProposedTime: true,
        planning: true,
      }),
    ).toMatch(/not locked in yet/);
  });
});
