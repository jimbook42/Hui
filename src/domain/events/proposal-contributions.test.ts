import { describe, expect, it } from "vitest";

import { normalizeProposalContributionRequests } from "./proposal-contributions";

describe("normalizeProposalContributionRequests", () => {
  it("dedupes categories and normalises labels", () => {
    const categories = new Map([
      ["cat-1", "Dessert"],
      ["cat-2", "Drinks"],
    ]);
    const result = normalizeProposalContributionRequests(
      [
        { categoryId: "cat-1", label: "  Cake " },
        { categoryId: "cat-1", label: "Pie" },
        { categoryId: "cat-2", label: "" },
      ],
      categories,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requests).toEqual([
        { categoryId: "cat-1", label: "Cake" },
        { categoryId: "cat-2", label: "Drinks" },
      ]);
    }
  });
});
