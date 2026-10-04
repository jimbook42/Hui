import { describe, expect, it } from "vitest";

import {
  participantAttendanceChoiceLabel,
  participantAttendanceSummaryLabel,
} from "./participant-labels";

describe("participant attendance labels (HUI-026B)", () => {
  it("uses invitee vocabulary, not coordination-page labels", () => {
    expect(participantAttendanceChoiceLabel("available")).toBe("Yes, I can come");
    expect(participantAttendanceChoiceLabel("maybe")).toBe("Maybe, I can make it work");
    expect(participantAttendanceChoiceLabel("unavailable")).toBe("No, I can't come");
    expect(participantAttendanceSummaryLabel("available")).toBe("Can come");
    expect(participantAttendanceSummaryLabel("available")).not.toBe("Available");
  });
});
