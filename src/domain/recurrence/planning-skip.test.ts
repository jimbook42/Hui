import { describe, expect, it } from "vitest";

import {
  friendlyPlanningSkipError,
  pickDefaultSkipNominalDate,
} from "./planning-skip";
import type { GroupPlanningCycle } from "./planning-cycle";

const weeklyCycle: GroupPlanningCycle = {
  cadence: { intervalUnit: "week", intervalCount: 1, anchorDate: "2026-10-01" },
  planningLeadDays: 14,
  nextTargetDate: "2026-10-26",
  planningOpensOn: "2026-10-12",
  phase: "ready_to_plan",
  blockingEventId: null,
  cycleTargetDate: "2026-10-26",
};

describe("pickDefaultSkipNominalDate", () => {
  it("advances past dates that are already skipped", () => {
    expect(pickDefaultSkipNominalDate(weeklyCycle, ["2026-10-26"])).toBe("2026-11-02");
  });

  it("returns the open date when it is not skipped", () => {
    expect(pickDefaultSkipNominalDate(weeklyCycle, [])).toBe("2026-10-26");
  });
});

describe("friendlyPlanningSkipError", () => {
  it("maps duplicate skip to plain language", () => {
    expect(
      friendlyPlanningSkipError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "planning_skip_unique"',
      }),
    ).toBe("That date is already skipped.");
  });
});
