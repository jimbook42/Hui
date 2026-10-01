import { describe, expect, it } from "vitest";

import {
  isDuplicateCandidate,
  parseAvailabilityChoice,
  validateAvailabilityChoice,
  validateCandidateWindow,
} from "./validation";

describe("scheduling validation", () => {
  it("parses availability choices", () => {
    expect(parseAvailabilityChoice("available")).toBe("available");
    expect(parseAvailabilityChoice("maybe")).toBe("maybe");
    expect(parseAvailabilityChoice("nope")).toBeNull();
  });

  it("rejects maybe when disabled", () => {
    expect(validateAvailabilityChoice("maybe", false)).toMatch(/not allowed/);
    expect(validateAvailabilityChoice("maybe", true)).toBeNull();
  });

  it("validates candidate time window", () => {
    expect(
      validateCandidateWindow("2026-11-01T10:00:00.000Z", "2026-11-01T09:00:00.000Z"),
    ).toMatch(/after start/);
    expect(
      validateCandidateWindow("2026-11-01T10:00:00.000Z", "2026-11-01T11:00:00.000Z"),
    ).toBeNull();
  });

  it("detects duplicate active candidates", () => {
    const existing = [
      {
        startsAt: "2026-11-01T10:00:00.000Z",
        endsAt: "2026-11-01T12:00:00.000Z",
        status: "proposed",
      },
      {
        startsAt: "2026-11-02T10:00:00.000Z",
        endsAt: "2026-11-02T12:00:00.000Z",
        status: "withdrawn",
      },
    ];
    expect(
      isDuplicateCandidate(
        existing,
        "2026-11-01T10:00:00.000Z",
        "2026-11-01T12:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      isDuplicateCandidate(
        existing,
        "2026-11-02T10:00:00.000Z",
        "2026-11-02T12:00:00.000Z",
      ),
    ).toBe(false);
  });
});
