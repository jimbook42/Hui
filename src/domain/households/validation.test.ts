import { describe, expect, it } from "vitest";

import { normalizeHouseholdName } from "./validation";

describe("normalizeHouseholdName", () => {
  it("accepts a trimmed name within length bounds", () => {
    expect(normalizeHouseholdName("  Isaac & Alice  ")).toBe("Isaac & Alice");
  });

  it("rejects empty and overlong names", () => {
    expect(normalizeHouseholdName("   ")).toBeNull();
    expect(normalizeHouseholdName("a".repeat(81))).toBeNull();
  });
});
