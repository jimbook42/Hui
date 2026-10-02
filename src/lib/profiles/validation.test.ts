import { describe, expect, it } from "vitest";

import { normalizeDisplayName } from "./validation";

describe("normalizeDisplayName", () => {
  it("trims and accepts valid names", () => {
    expect(normalizeDisplayName("  Alex  ")).toBe("Alex");
  });

  it("rejects empty and overlong names", () => {
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("a".repeat(81))).toBeNull();
  });

  it("accepts names up to 80 characters", () => {
    const name = "a".repeat(80);
    expect(normalizeDisplayName(name)).toBe(name);
  });
});
