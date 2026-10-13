import { describe, expect, it } from "vitest";

import { buildNominalDatePreview } from "./nominal-preview";
import type { GroupPlanningCycle } from "./planning-cycle";

const WEEKLY = {
  intervalUnit: "week" as const,
  intervalCount: 1,
  anchorDate: "2026-09-28",
};

const baseCycle: GroupPlanningCycle = {
  cadence: WEEKLY,
  planningLeadDays: 14,
  nextTargetDate: "2026-10-26",
  planningOpensOn: "2026-10-12",
  phase: "ready_to_plan",
  blockingEventId: null,
  cycleTargetDate: "2026-10-26",
};

describe("buildNominalDatePreview", () => {
  it("lists four cadence steps from the next open target", () => {
    const rows = buildNominalDatePreview({
      cadence: WEEKLY,
      cycle: baseCycle,
      events: [],
      skippedNominalDates: [],
      skipReasons: {},
      count: 4,
    });
    expect(rows.map((row) => row.nominalDate)).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
    ]);
    expect(rows[0].disposition).toBe("next_open");
    expect(rows[1].disposition).toBe("upcoming_open");
  });

  it("marks skipped nominals and continues the cadence", () => {
    const rows = buildNominalDatePreview({
      cadence: WEEKLY,
      cycle: baseCycle,
      events: [],
      skippedNominalDates: ["2026-11-02"],
      skipReasons: { "2026-11-02": "Away" },
      count: 4,
    });
    expect(rows[1]).toMatchObject({
      nominalDate: "2026-11-02",
      disposition: "skipped",
      skipReason: "Away",
    });
  });

  it("shows occupied cycles from events", () => {
    const rows = buildNominalDatePreview({
      cadence: WEEKLY,
      cycle: baseCycle,
      events: [
        {
          id: "e1",
          status: "confirmed",
          planningTargetDate: "2026-10-26",
          startsAt: null,
          recurrenceSeriesId: "s1",
        },
      ],
      skippedNominalDates: [],
      skipReasons: {},
      count: 3,
    });
    expect(rows[0].disposition).toBe("confirmed");
    expect(rows[1].disposition).toBe("next_open");
  });
});
