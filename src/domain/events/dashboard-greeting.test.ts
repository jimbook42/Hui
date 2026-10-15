import { describe, expect, it } from "vitest";

import { dashboardHuiGreetingLine } from "./dashboard-greeting";

describe("dashboardHuiGreetingLine", () => {
  const tz = "Pacific/Auckland";

  it("uses a calm default when nothing is scheduled", () => {
    expect(dashboardHuiGreetingLine(null, tz, "2026-10-15")).toBe(
      "Ready to plan your next hui?",
    );
  });

  it("says this week when the hui is in the same week", () => {
    expect(
      dashboardHuiGreetingLine("2026-10-17T08:00:00.000Z", tz, "2026-10-15"),
    ).toBe("Ready for this week's hui?");
  });

  it("says next week when the hui is the following week", () => {
    expect(
      dashboardHuiGreetingLine("2026-10-24T08:00:00.000Z", tz, "2026-10-15"),
    ).toBe("Ready for next week's hui?");
  });

  it("names the date when the hui is further out", () => {
    expect(
      dashboardHuiGreetingLine("2026-11-30T08:00:00.000Z", tz, "2026-10-15"),
    ).toBe("Your next hui is 30 November.");
  });
});
