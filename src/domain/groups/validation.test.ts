import { describe, expect, it } from "vitest";

import { normalizeGroupName, parseUserId } from "./validation";

describe("normalizeGroupName", () => {
  it("accepts trimmed names within length bounds", () => {
    expect(normalizeGroupName("  Whānau  ")).toBe("Whānau");
  });

  it("rejects empty names", () => {
    expect(normalizeGroupName("   ")).toBeNull();
  });
});

describe("parseUserId", () => {
  it("accepts lowercase UUIDs", () => {
    expect(parseUserId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
  });

  it("rejects invalid ids", () => {
    expect(parseUserId("not-a-uuid")).toBeNull();
  });
});
