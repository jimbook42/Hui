import { describe, expect, it } from "vitest";

import {
  normalizeDietaryLabel,
  normalizeDietaryNotes,
  parseDietaryCategory,
  parseDietaryEntryId,
  parseGroupId,
} from "@/domain/dietary/validation";

describe("dietary validation", () => {
  it("accepts a valid label and notes", () => {
    expect(normalizeDietaryLabel("Vegetarian")).toBe("Vegetarian");
    expect(normalizeDietaryNotes("eggs okay")).toBe("eggs okay");
    expect(normalizeDietaryNotes("")).toBeNull();
    expect(normalizeDietaryNotes("   ")).toBeNull();
  });

  it("rejects empty or overlong label", () => {
    expect(normalizeDietaryLabel("")).toBeNull();
    expect(normalizeDietaryLabel("a".repeat(121))).toBeNull();
  });

  it("rejects overlong notes", () => {
    expect(normalizeDietaryNotes("a".repeat(501))).toBeNull();
  });

  it("parses category and ids", () => {
    expect(parseDietaryCategory("requirement")).toBe("requirement");
    expect(parseDietaryCategory("invalid")).toBeNull();
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseDietaryEntryId(id)).toBe(id);
    expect(parseGroupId(id)).toBe(id);
    expect(parseDietaryEntryId("not-a-uuid")).toBeNull();
  });
});
