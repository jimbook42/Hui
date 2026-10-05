import { describe, expect, it } from "vitest";

import { gatheringPlanningPhrase } from "./type";

describe("gatheringPlanningPhrase", () => {
  it("uses type and title without inferring type from title", () => {
    expect(
      gatheringPlanningPhrase({
        type: "dinner_meal",
        customDescription: null,
        eventTitle: "Friday thing",
      }),
    ).toBe("Friday thing dinner");
  });

  it("falls back to type-only phrasing", () => {
    expect(
      gatheringPlanningPhrase({
        type: "golf",
        customDescription: null,
        eventTitle: "",
      }),
    ).toBe("a round of golf");
  });

  it("uses custom description for other", () => {
    expect(
      gatheringPlanningPhrase({
        type: "other",
        customDescription: "Book club",
        eventTitle: "",
      }),
    ).toBe("Book club");
  });
});
