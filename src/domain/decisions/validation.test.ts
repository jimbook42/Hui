import { describe, expect, it } from "vitest";

import {
  parseDecisionOptionDrafts,
  validateDecisionOptionInputs,
} from "@/domain/decisions/validation";

describe("parseDecisionOptionDrafts", () => {
  it("keeps comma-containing text as one option", () => {
    expect(parseDecisionOptionDrafts(["Thai, Indian or pizza", "Home"])).toEqual([
      "Thai, Indian or pizza",
      "Home",
    ]);
  });

  it("ignores empty rows", () => {
    expect(parseDecisionOptionDrafts(["A", "", "  ", "B"])).toEqual(["A", "B"]);
  });

  it("allows up to twelve options", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Option ${i + 1}`);
    expect(parseDecisionOptionDrafts(labels)).toHaveLength(12);
  });
});

describe("validateDecisionOptionInputs", () => {
  it("requires at least two non-empty options", () => {
    expect(validateDecisionOptionInputs(["Only one"])).toMatch(/at least two/i);
  });

  it("rejects duplicate options case-insensitively", () => {
    expect(validateDecisionOptionInputs(["Pizza", "pizza"])).toMatch(/unique/i);
  });
});
