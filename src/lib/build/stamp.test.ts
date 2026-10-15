import { afterEach, describe, expect, it, vi } from "vitest";

import { buildStamp } from "@/lib/build/stamp";

describe("buildStamp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses NEXT_PUBLIC_HUI_BUILD_SHA when set", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_BUILD_SHA", "abc123456789");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect(buildStamp()).toBe("abc1234");
  });

  it("falls back to VERCEL_GIT_COMMIT_SHA", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_BUILD_SHA", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "deadbeef");
    expect(buildStamp()).toBe("deadbee");
  });
});
