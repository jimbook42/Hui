import { describe, expect, it } from "vitest";

import { viewerPrivateNoteForDisplay } from "@/domain/events/participant-flow";

describe("viewerPrivateNoteForDisplay", () => {
  it("uses the proposed time with a No answer and note when not the first candidate", () => {
    const note = viewerPrivateNoteForDisplay(
      [
        {
          id: "a",
          startsAt: "2026-10-20T12:00:00Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "available",
          viewerPrivateNote: null,
        },
        {
          id: "b",
          startsAt: "2026-10-21T12:00:00Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "unavailable",
          viewerPrivateNote: "Away that day",
        },
      ],
      "proposing",
    );
    expect(note).toBe("Away that day");
  });

  it("returns a No note when the viewer answered Yes to one time and No to another", () => {
    const note = viewerPrivateNoteForDisplay(
      [
        {
          id: "t1",
          startsAt: "2026-10-20T12:00:00Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "available",
          viewerPrivateNote: null,
        },
        {
          id: "t2",
          startsAt: "2026-10-21T12:00:00Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "unavailable",
          viewerPrivateNote: "Busy that day QA",
        },
      ],
      "proposing",
    );
    expect(note).toBe("Busy that day QA");
  });

  it("uses the selected time note when confirmed", () => {
    const note = viewerPrivateNoteForDisplay(
      [
        {
          id: "a",
          startsAt: "2026-10-20T12:00:00Z",
          endsAt: null,
          status: "proposed",
          viewerResponse: "unavailable",
          viewerPrivateNote: "ignore",
        },
        {
          id: "b",
          startsAt: "2026-10-21T12:00:00Z",
          endsAt: null,
          status: "selected",
          viewerResponse: "unavailable",
          viewerPrivateNote: "Cannot make it",
        },
      ],
      "confirmed",
    );
    expect(note).toBe("Cannot make it");
  });
});
