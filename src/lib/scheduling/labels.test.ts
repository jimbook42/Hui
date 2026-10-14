import { describe, expect, it } from "vitest";

import { consensusFailureLabel, consensusRuleLabel } from "./labels";

describe("scheduling labels (HUI-022A.2)", () => {
  it("keeps required-participants label when no members are marked required", () => {
    expect(consensusRuleLabel("required_participants")).toBe("Required participants");
  });

  it("labels minimum_attendees from the persisted rule", () => {
    expect(consensusRuleLabel("minimum_attendees")).toBe("Minimum attendees");
  });

  it("uses a safe fallback for unknown consensus failure reasons", () => {
    expect(
      consensusFailureLabel("future_rule_from_migration", {
        acceptedCount: 1,
        minimumAttendees: 2,
      }),
    ).toMatch(/does not meet the group's rules yet/i);
  });
});
