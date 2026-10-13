import { describe, expect, it } from "vitest";

import { buildNominalDatePreview } from "@/domain/recurrence/nominal-preview";
import {
  deriveGroupPlanningCycle,
  pickOpenCycleNominalDate,
  shouldShowManualProposeLink,
} from "@/domain/recurrence/planning-cycle";

const WEEKLY = {
  intervalUnit: "week" as const,
  intervalCount: 1,
  anchorDate: "2026-09-28",
};

const BIWEEKLY_OCT = {
  intervalUnit: "week" as const,
  intervalCount: 2,
  anchorDate: "2026-10-19",
};

describe("HUI-031 tier-2 QA (planning cycle)", () => {
  it("1: complete advances to the next open nominal immediately (before event day)", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: WEEKLY,
      planningLeadDays: 14,
      todayDateOnly: "2026-10-13",
      events: [
        {
          id: "e1",
          status: "completed",
          planningTargetDate: "2026-10-19",
          startsAt: "2026-10-19T10:00:00.000Z",
          recurrenceSeriesId: "s1",
        },
      ],
    });
    expect(cycle.nextTargetDate).toBe("2026-10-26");
    expect(cycle.phase).toBe("ready_to_plan");
    expect(pickOpenCycleNominalDate(cycle)).toBe("2026-10-26");
  });

  it("3: paused recurrence hides manual propose link", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: WEEKLY,
      planningLeadDays: 14,
      todayDateOnly: "2026-10-13",
      events: [],
      recurrencePaused: true,
    });
    expect(
      shouldShowManualProposeLink({
        canPropose: true,
        recurrencePaused: true,
        cycle,
      }),
    ).toBe(false);
  });

  it("4: skip advances next target and open nominal picks skipped-forward date", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: WEEKLY,
      planningLeadDays: 14,
      todayDateOnly: "2026-10-13",
      events: [
        {
          id: "e1",
          status: "completed",
          planningTargetDate: "2026-10-19",
          startsAt: "2026-10-19T10:00:00.000Z",
          recurrenceSeriesId: "s1",
        },
      ],
      skippedNominalDates: ["2026-10-26"],
    });
    expect(cycle.nextTargetDate).toBe("2026-11-02");
    expect(pickOpenCycleNominalDate(cycle)).toBe("2026-11-02");
  });

  it("HUI-031-C QA: skipping a future nominal keeps the current next target", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: BIWEEKLY_OCT,
      planningLeadDays: 14,
      todayDateOnly: "2026-10-13",
      events: [],
      skippedNominalDates: ["2026-11-02"],
    });
    expect(cycle.nextTargetDate).toBe("2026-10-19");

    const preview = buildNominalDatePreview({
      cadence: BIWEEKLY_OCT,
      cycle,
      todayDateOnly: "2026-10-13",
      events: [],
      skippedNominalDates: ["2026-11-02"],
      skipReasons: {},
      count: 4,
    });
    expect(preview[0]).toMatchObject({
      nominalDate: "2026-10-19",
      disposition: "next_open",
    });
    expect(preview[1]).toMatchObject({
      nominalDate: "2026-11-02",
      disposition: "skipped",
    });
  });
});
