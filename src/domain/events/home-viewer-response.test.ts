import { describe, expect, it } from "vitest";

import {
  homeViewerResponseCandidateIds,
  viewerResponseForHomeList,
} from "@/domain/events/home-viewer-response";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

describe("home viewer response", () => {
  it("loads every proposed candidate id for multi-time events", () => {
    const ids = homeViewerResponseCandidateIds([
      { id: "a", status: "proposed" },
      { id: "b", status: "proposed" },
    ]);
    expect(ids).toEqual(["a", "b"]);
  });

  it("treats multi-time proposing as unanswered until all times have answers", () => {
    const responses = new Map<string, AvailabilityChoice>([["a", "available"]]);
    expect(
      viewerResponseForHomeList(
        [
          { id: "a", status: "proposed" },
          { id: "b", status: "proposed" },
        ],
        "proposing",
        responses,
      ),
    ).toBeNull();
  });

  it("aggregates multi-time answers once every proposed time is answered", () => {
    const responses = new Map<string, AvailabilityChoice>([
      ["a", "available"],
      ["b", "maybe"],
    ]);
    expect(
      viewerResponseForHomeList(
        [
          { id: "a", status: "proposed" },
          { id: "b", status: "proposed" },
        ],
        "proposing",
        responses,
      ),
    ).toBe("available");
  });
});
