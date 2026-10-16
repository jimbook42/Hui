import { afterEach, describe, expect, it, vi } from "vitest";

import { householdsEnabled } from "@/lib/features";

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
