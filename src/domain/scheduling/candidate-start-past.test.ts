import { describe, expect, it } from "vitest";

import {
  activeProposedCandidates,
  isCandidateStartInPast,
  validateCandidateStartNotPast,
} from "@/domain/scheduling/candidate-start-past";

describe("candidate start in past", () => {
  const now = "2026-10-16T10:00:00.000Z";

  it("blocks starts at or before now", () => {
    expect(isCandidateStartInPast("2026-10-16T09:00:00.000Z", now)).toBe(true);
    expect(isCandidateStartInPast("2026-10-16T10:00:00.000Z", now)).toBe(true);
    expect(isCandidateStartInPast("2026-10-16T11:00:00.000Z", now)).toBe(false);
  });

  it("returns the product error message", () => {
    expect(validateCandidateStartNotPast("2026-10-16T09:00:00.000Z", now)).toMatch(
      /already passed/i,
    );
  });

  it("excludes passed proposed times from active lists", () => {
    const rows = activeProposedCandidates(
      [
        { id: "1", startsAt: "2026-10-15T10:00:00.000Z", status: "proposed" },
        { id: "2", startsAt: "2026-10-20T10:00:00.000Z", status: "proposed" },
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(["2"]);
  });
});
