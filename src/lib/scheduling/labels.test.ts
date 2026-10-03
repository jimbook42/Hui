import { describe, expect, it } from "vitest";

import { consensusRuleLabel } from "./labels";

describe("scheduling labels (HUI-022A.2)", () => {
  it("keeps required-participants label when no members are marked required", () => {
    expect(consensusRuleLabel("required_participants")).toBe("Required participants");
  });

  it("labels minimum_attendees from the persisted rule", () => {
    expect(consensusRuleLabel("minimum_attendees")).toBe("Minimum attendees");
  });
});
