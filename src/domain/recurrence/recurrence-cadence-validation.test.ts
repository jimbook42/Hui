import { describe, expect, it } from "vitest";

import { parseRecurrenceCadenceInput } from "./recurrence-cadence-validation";

describe("parseRecurrenceCadenceInput", () => {
  it("accepts valid week cadence", () => {
    const result = parseRecurrenceCadenceInput({
      intervalUnit: "week",
      intervalCount: 2,
      anchorDate: "2026-05-01",
    });
    expect(result.error).toBeNull();
    expect(result.cadence).toEqual({
      intervalUnit: "week",
      intervalCount: 2,
      anchorDate: "2026-05-01",
    });
  });

  it("rejects invalid unit or count", () => {
    expect(
      parseRecurrenceCadenceInput({
        intervalUnit: "day",
        intervalCount: 1,
        anchorDate: "2026-05-01",
      }).error,
    ).toBeTruthy();
    expect(
      parseRecurrenceCadenceInput({
        intervalUnit: "month",
        intervalCount: 0,
        anchorDate: "2026-05-01",
      }).error,
    ).toBeTruthy();
  });
});
