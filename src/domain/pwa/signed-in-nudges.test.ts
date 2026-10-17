import { describe, expect, it } from "vitest";

import { isOnboardingAppPath, pickSignedInNudge } from "./signed-in-nudges";

describe("isOnboardingAppPath", () => {
  it("flags profile setup and group welcome", () => {
    expect(isOnboardingAppPath("/profile/setup")).toBe(true);
    expect(isOnboardingAppPath("/groups/abc/welcome")).toBe(true);
    expect(isOnboardingAppPath("/groups/abc/welcome/")).toBe(true);
  });

  it("allows normal signed-in routes", () => {
    expect(isOnboardingAppPath("/dashboard")).toBe(false);
    expect(isOnboardingAppPath("/events")).toBe(false);
    expect(isOnboardingAppPath("/groups/abc")).toBe(false);
  });
});

describe("pickSignedInNudge", () => {
  it("prefers install when both are eligible", () => {
    expect(
      pickSignedInNudge({ installEligible: true, notificationEligible: true }),
    ).toBe("install");
  });

  it("falls back to notification", () => {
    expect(
      pickSignedInNudge({ installEligible: false, notificationEligible: true }),
    ).toBe("notification");
  });

  it("returns false when nothing applies", () => {
    expect(
      pickSignedInNudge({ installEligible: false, notificationEligible: false }),
    ).toBe(false);
  });
});
