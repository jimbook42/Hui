import { describe, expect, it } from "vitest";

import {
  normalizeCategoryName,
  normalizeContributionDescription,
  normalizeContributionLabelUpdate,
} from "./validation";

describe("contribution validation", () => {
  it("accepts valid category names", () => {
    expect(normalizeCategoryName("Dessert")).toBe("Dessert");
  });

  it("rejects empty or oversized category names", () => {
    expect(normalizeCategoryName("")).toBeNull();
    expect(normalizeCategoryName("a".repeat(61))).toBeNull();
  });

  it("defaults description to category name when empty", () => {
    expect(normalizeContributionDescription("", "Drinks")).toBe("Drinks");
  });

  it("trims custom descriptions", () => {
    expect(normalizeContributionDescription("  Chocolate cake  ", "Dessert")).toBe("Chocolate cake");
  });

  it("requires non-empty label updates", () => {
    expect(normalizeContributionLabelUpdate("  chips  ")).toBe("chips");
    expect(normalizeContributionLabelUpdate("")).toBeNull();
  });
});
