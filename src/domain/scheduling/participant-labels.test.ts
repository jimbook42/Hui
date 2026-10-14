import { describe, expect, it } from "vitest";

import {
  participantAttendanceChoiceLabel,
  participantAttendanceSummaryLabel,
} from "./participant-labels";

describe("participant attendance labels (HUI-UX1)", () => {
  it("uses short consistent labels in the respond flow", () => {
    expect(participantAttendanceChoiceLabel("available")).toBe("Yes");
    expect(participantAttendanceChoiceLabel("maybe")).toBe("Maybe");
    expect(participantAttendanceChoiceLabel("unavailable")).toBe("Can't");
    expect(participantAttendanceSummaryLabel("maybe")).toBe("Maybe");
    expect(participantAttendanceSummaryLabel("available")).toBe("Yes");
    expect(participantAttendanceSummaryLabel("available", { confirmed: true })).toBe(
      "You're in",
    );
  });
});
