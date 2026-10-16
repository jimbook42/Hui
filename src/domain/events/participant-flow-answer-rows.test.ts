import { describe, expect, it } from "vitest";

import { multiTimeAnswerDetailRows } from "@/domain/events/participant-flow";

describe("multiTimeAnswerDetailRows notes", () => {
  it("attaches each private note to its time row", () => {
    const rows = multiTimeAnswerDetailRows(
      [
        {
          id: "sat",
          startsAt: "2026-02-06T23:00:00.000Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "unavailable",
          viewerPrivateNote: "Sick",
        },
        {
          id: "sun",
          startsAt: "2026-02-07T23:00:00.000Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "available",
          viewerPrivateNote: null,
        },
      ],
      { sat: "Sat 6 Feb, 12pm", sun: "Sun 7 Feb, 12pm" },
    );

    const sat = rows.find((row) => row.candidateId === "sat");
    const sun = rows.find((row) => row.candidateId === "sun");
    expect(sat?.privateNote).toBe("Sick");
    expect(sun?.privateNote).toBeNull();
  });
});
