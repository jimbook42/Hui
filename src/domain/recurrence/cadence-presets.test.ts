import { describe, expect, it } from "vitest";

import {
  cadencePresetFromParts,
  formatCadenceLabel,
} from "@/domain/recurrence/cadence-presets";

describe("cadence presets", () => {
  it("maps fortnightly to week interval 2", () => {
    expect(cadencePresetFromParts("week", 2)).toBe("fortnightly");
    expect(formatCadenceLabel({ intervalUnit: "week", intervalCount: 2 })).toBe(
      "Every fortnight",
    );
  });

  it("maps weekly and monthly", () => {
    expect(cadencePresetFromParts("week", 1)).toBe("weekly");
    expect(formatCadenceLabel({ intervalUnit: "week", intervalCount: 1 })).toBe("Every week");
    expect(cadencePresetFromParts("month", 1)).toBe("monthly");
    expect(formatCadenceLabel({ intervalUnit: "month", intervalCount: 1 })).toBe("Every month");
  });
});
