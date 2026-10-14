import { describe, expect, it } from "vitest";

import { isProposalDateBeforeToday } from "./proposal-past-time";

describe("isProposalDateBeforeToday", () => {
  it("detects dates before today in the group zone", () => {
    expect(isProposalDateBeforeToday("2026-10-01", "2026-10-14")).toBe(true);
    expect(isProposalDateBeforeToday("2026-10-14", "2026-10-14")).toBe(false);
    expect(isProposalDateBeforeToday("2026-11-01", "2026-10-14")).toBe(false);
  });
});
