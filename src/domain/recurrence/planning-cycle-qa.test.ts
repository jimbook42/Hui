import { describe, expect, it } from "vitest";

import {
  computeNextTargetDate,
  deriveGroupPlanningCycle,
  pickOpenCycleNominalDate,
  resolveCycleReferenceDate,
  shouldShowManualProposeLink,
} from "@/domain/recurrence/planning-cycle";

const WEEKLY = {
  intervalUnit: "week" as const,
  intervalCount: 1,
  anchorDate: "2026-09-28",
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

  it("4b: skip reference marks closed cycle for computeNextTargetDate", () => {
    const ref = resolveCycleReferenceDate([], WEEKLY.anchorDate, "2026-10-13", [
      "2026-10-26",
    ]);
    expect(ref.afterClosedCycle).toBe(true);
    expect(
      computeNextTargetDate(WEEKLY, ref.referenceDate, "2026-10-13", ref.afterClosedCycle),
    ).toBe("2026-11-02");
  });
});
