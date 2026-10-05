import { describe, expect, it } from "vitest";

import { defaultOpenManageSection } from "@/domain/events/manage-navigation";

describe("defaultOpenManageSection", () => {
  it("opens time when finalisation is ready", () => {
    expect(
      defaultOpenManageSection({
        canFinalise: true,
        anyCandidatePasses: true,
        coordinateContributions: true,
        unclaimedContributionCount: 3,
        canAssignHost: true,
        hasAcceptedHost: false,
      }),
    ).toBe("time");
  });

  it("opens contributions when coordination is outstanding", () => {
    expect(
      defaultOpenManageSection({
        canFinalise: false,
        anyCandidatePasses: false,
        coordinateContributions: true,
        unclaimedContributionCount: 2,
        canAssignHost: true,
        hasAcceptedHost: false,
      }),
    ).toBe("contributions");
  });

  it("falls back to hui overview", () => {
    expect(
      defaultOpenManageSection({
        canFinalise: false,
        anyCandidatePasses: false,
        coordinateContributions: false,
        unclaimedContributionCount: 0,
        canAssignHost: false,
        hasAcceptedHost: true,
      }),
    ).toBe("hui");
  });
});
