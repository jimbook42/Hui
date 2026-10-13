import { describe, expect, it } from "vitest";

import {
  cadenceFromParts,
  computeNextTargetDate,
  deriveGroupPlanningCycle,
  resolveCycleReferenceDate,
  shouldShowPlanNextCta,
} from "@/domain/recurrence/planning-cycle";

const CADENCE = {
  intervalUnit: "week" as const,
  intervalCount: 6,
  anchorDate: "2026-01-01",
};

describe("recurring planning cycle (HUI-028)", () => {
  it("derives next target from anchor when nothing happened yet", () => {
    expect(
      computeNextTargetDate(CADENCE, "2026-01-01", "2026-03-01"),
    ).toBe("2026-03-26");
  });

  it("derives planning window from lead days", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: CADENCE,
      planningLeadDays: 14,
      todayDateOnly: "2026-03-12",
      events: [],
    });
    expect(cycle.nextTargetDate).toBe("2026-03-26");
    expect(cycle.planningOpensOn).toBe("2026-03-12");
    expect(cycle.phase).toBe("ready_to_plan");
    expect(shouldShowPlanNextCta(cycle)).toBe(true);
  });

  it("not-yet-due group does not produce planning CTA", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: CADENCE,
      planningLeadDays: 14,
      todayDateOnly: "2026-01-10",
      events: [],
    });
    expect(cycle.phase).toBe("not_due");
    expect(shouldShowPlanNextCta(cycle)).toBe(false);
  });

  it("active proposing event blocks duplicate cycle", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence: CADENCE,
      planningLeadDays: 14,
      todayDateOnly: "2026-03-01",
      events: [
        {
          id: "e1",
          status: "proposing",
          planningTargetDate: "2026-03-12",
          startsAt: null,
          recurrenceSeriesId: "s1",
        },
      ],
    });
    expect(cycle.phase).toBe("planning_exists");
    expect(shouldShowPlanNextCta(cycle)).toBe(false);
  });

  it("completed hui advances reference for next target", () => {
    const reference = resolveCycleReferenceDate(
      [
        {
          id: "e1",
          status: "completed",
          planningTargetDate: "2026-03-12",
          startsAt: "2026-03-12T10:00:00.000Z",
          recurrenceSeriesId: "s1",
        },
      ],
      CADENCE.anchorDate,
      "2026-04-01",
    );
    expect(reference).toBe("2026-03-12");
    expect(
      computeNextTargetDate(CADENCE, reference, "2026-04-01"),
    ).toBe("2026-04-23");
  });

  it("cancelled hui does not advance the cycle reference", () => {
    const reference = resolveCycleReferenceDate(
      [
        {
          id: "e1",
          status: "cancelled",
          planningTargetDate: "2026-03-12",
          startsAt: null,
          recurrenceSeriesId: "s1",
        },
      ],
      CADENCE.anchorDate,
      "2026-03-01",
    );
    expect(reference).toBe(CADENCE.anchorDate);
  });

  it("one-off group unchanged", () => {
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: false,
      cadence: null,
      planningLeadDays: 14,
      todayDateOnly: "2026-03-01",
      events: [],
    });
    expect(cycle.phase).toBe("not_recurring");
  });

  it("parses cadence parts safely", () => {
    expect(cadenceFromParts("week", 2, "2026-05-01")).toEqual({
      intervalUnit: "week",
      intervalCount: 2,
      anchorDate: "2026-05-01",
    });
    expect(cadenceFromParts("day", 1, "2026-05-01")).toBeNull();
  });
});
