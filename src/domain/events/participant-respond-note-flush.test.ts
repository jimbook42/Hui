import { describe, expect, it } from "vitest";

import { candidateIdsNeedingNoteFlushBeforeAdvance } from "@/domain/events/participant-respond-note-flush";

describe("candidateIdsNeedingNoteFlushBeforeAdvance", () => {
  it("includes every proposed time answered No before Done advances the flow", () => {
    const ids = candidateIdsNeedingNoteFlushBeforeAdvance(
      {
        t1: "available",
        t2: "unavailable",
        t3: "maybe",
        t4: null,
      },
      ["t1", "t2", "t3", "t4"],
    );
    expect(ids).toEqual(["t2"]);
  });
});
