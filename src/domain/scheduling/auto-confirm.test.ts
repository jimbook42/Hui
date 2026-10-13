import { describe, expect, it } from "vitest";

import { selectPassingCandidate } from "@/domain/scheduling/auto-confirm";

describe("auto-confirm candidate pick", () => {
  it("chooses the earliest passing candidate, then lowest id", () => {
    const picked = selectPassingCandidate([
      {
        id: "b",
        startsAt: "2026-12-02T10:00:00Z",
        passes: true,
      },
      {
        id: "a",
        startsAt: "2026-12-01T10:00:00Z",
        passes: true,
      },
      {
        id: "c",
        startsAt: "2026-12-01T10:00:00Z",
        passes: false,
      },
    ]);
    expect(picked?.id).toBe("a");
  });

  it("returns null when no candidate passes", () => {
    expect(
      selectPassingCandidate([
        { id: "a", startsAt: "2026-12-01T10:00:00Z", passes: false },
      ]),
    ).toBeNull();
  });
});
