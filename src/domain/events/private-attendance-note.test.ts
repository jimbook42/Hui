import { describe, expect, it } from "vitest";

import { privateAttendanceNoteForCandidate } from "./private-attendance-note";

describe("privateAttendanceNoteForCandidate", () => {
  it("uses the note map as it stands when save runs, not an earlier captured value", () => {
    const notesByCandidate: Record<string, string> = { c1: "Away that weekend Q" };
    // Debounced save fired with stale closure would persist only "Q"; flush must read this update.
    notesByCandidate.c1 = "Away that weekend QA";

    expect(
      privateAttendanceNoteForCandidate({
        multipleTimeOptions: true,
        candidateId: "c1",
        notesByCandidate,
        singleNote: "",
      }),
    ).toBe("Away that weekend QA");
  });

  it("returns the full single-time note string", () => {
    expect(
      privateAttendanceNoteForCandidate({
        multipleTimeOptions: false,
        candidateId: "c1",
        notesByCandidate: {},
        singleNote: "Away that weekend QA",
      }),
    ).toBe("Away that weekend QA");
  });
});
