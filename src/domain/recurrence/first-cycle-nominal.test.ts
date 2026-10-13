import { describe, expect, it } from "vitest";

import { firstGroupCycleNominalDate } from "./first-cycle-nominal";

describe("firstGroupCycleNominalDate", () => {
  it("uses today as the first nominal for weekly and monthly cadence", () => {
    expect(
      firstGroupCycleNominalDate(
        { intervalUnit: "month", intervalCount: 1 },
        "2026-10-13",
      ),
    ).toBe("2026-10-13");
    expect(
      firstGroupCycleNominalDate(
        { intervalUnit: "week", intervalCount: 1 },
        "2026-10-13",
      ),
    ).toBe("2026-10-13");
  });
});
