import { describe, expect, it } from "vitest";

import { formatAvailabilityNudgeSuccessMessage } from "./availability-nudge-copy";

describe("formatAvailabilityNudgeSuccessMessage", () => {
  it("uses singular copy for one member", () => {
    expect(formatAvailabilityNudgeSuccessMessage(1)).toBe(
      "Nudge sent to 1 member who hasn't answered yet.",
    );
  });

  it("uses plural copy for multiple members", () => {
    expect(formatAvailabilityNudgeSuccessMessage(3)).toBe(
      "Nudge sent to 3 members who haven't answered yet.",
    );
  });

  it("reports when nobody needs a nudge", () => {
    expect(formatAvailabilityNudgeSuccessMessage(0)).toBe(
      "Everyone has already answered a proposed time.",
    );
  });
});
