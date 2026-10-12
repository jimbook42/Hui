import { describe, expect, it } from "vitest";

import { formatDateOnlyDisplay } from "./date-only";

describe("formatDateOnlyDisplay", () => {
  it("keeps 2 November on Pacific/Auckland-style display (no +1 day shift)", () => {
    expect(formatDateOnlyDisplay("2026-11-02")).toBe("2 November");
  });

  it("keeps 9 November unchanged", () => {
    expect(formatDateOnlyDisplay("2026-11-09")).toBe("9 November");
  });

  it("formats a month boundary date consistently", () => {
    expect(formatDateOnlyDisplay("2026-12-31")).toBe("31 December");
    expect(formatDateOnlyDisplay("2027-01-01")).toBe("1 January");
  });
});
