import { describe, expect, it } from "vitest";

import { isOrganiserAssignedContribution } from "./assignment-display";

describe("isOrganiserAssignedContribution", () => {
  it("is false for self-claims even when assigner metadata exists on open rows", () => {
    expect(
      isOrganiserAssignedContribution({
        userId: "member",
        assignedByUserId: "member",
      }),
    ).toBe(false);
  });

  it("is true when an organiser assigned a different member", () => {
    expect(
      isOrganiserAssignedContribution({
        userId: "member",
        assignedByUserId: "owner",
      }),
    ).toBe(true);
  });
});
