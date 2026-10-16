import { afterEach, describe, expect, it, vi } from "vitest";

import { householdsEnabled, profileHuiGroupsDescription } from "@/lib/features";

describe("householdsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off by default", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED", "");
    expect(householdsEnabled()).toBe(false);
  });

  it("is on when env is true", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED", "true");
    expect(householdsEnabled()).toBe(true);
  });
});

describe("profileHuiGroupsDescription", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits household wording when the feature is off", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED", "");
    expect(profileHuiGroupsDescription()).toBe("How you appear in each group");
    expect(profileHuiGroupsDescription()).not.toMatch(/household/i);
  });

  it("mentions households when the feature is on", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED", "true");
    expect(profileHuiGroupsDescription()).toContain("Households");
  });
});
