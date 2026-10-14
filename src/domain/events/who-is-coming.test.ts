import { describe, expect, it } from "vitest";

import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";

import { whoIsComingPresentation } from "./who-is-coming";

function rosterFor(
  responses: Array<"yes" | "maybe" | null>,
  maybeResponsesEnabled = true,
): AttendanceRoster {
  return {
    maybeResponsesEnabled,
    members: responses.map((response, index) => ({
      userId: `u${index}`,
      displayName: `Member ${index}`,
      response,
    })),
  };
}

describe("whoIsComingPresentation", () => {
  const candidates = [
    {
      id: "c1",
      startsAt: "2026-11-01T18:00:00Z",
      endsAt: null,
      status: "proposed" as const,
      viewerResponse: null,
    },
    {
      id: "c2",
      startsAt: "2026-11-02T18:00:00Z",
      endsAt: null,
      status: "proposed" as const,
      viewerResponse: null,
    },
  ];

  it("shows per-candidate tallies while proposing with multiple times", () => {
    const result = whoIsComingPresentation({
      eventStatus: "proposing",
      candidates,
      attendanceRosters: {
        c1: rosterFor(["yes", null]),
        c2: rosterFor(["yes", "yes"]),
      },
      maybeResponsesEnabled: true,
      focusCandidateId: "c1",
    });
    expect(result.mode).toBe("per-candidate");
    if (result.mode === "per-candidate") {
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.summary).toContain("1 coming");
      expect(result.rows[0]?.summary).toContain("1 yet to answer");
      expect(result.rows[1]?.summary).toContain("2 coming");
    }
  });

  it("shows awaiting answers on confirmed hui when nobody has said yes yet", () => {
    const result = whoIsComingPresentation({
      eventStatus: "confirmed",
      candidates: [
        { ...candidates[0], status: "selected" },
      ],
      attendanceRosters: {
        c1: rosterFor([null, null, null]),
      },
      maybeResponsesEnabled: true,
      focusCandidateId: "c1",
    });
    expect(result.mode).toBe("single");
    if (result.mode === "single") {
      expect(result.summary).toBe("Awaiting answers");
    }
  });

  it("uses a single roster after confirmation", () => {
    const result = whoIsComingPresentation({
      eventStatus: "confirmed",
      candidates: [
        { ...candidates[0], status: "selected" },
        { ...candidates[1], status: "proposed" },
      ],
      attendanceRosters: {
        c1: rosterFor(["yes", "maybe"]),
      },
      maybeResponsesEnabled: true,
      focusCandidateId: "c1",
    });
    expect(result.mode).toBe("single");
    if (result.mode === "single") {
      expect(result.summary).toContain("1 coming");
      expect(result.summary).toContain("1 maybe");
    }
  });
});
