import { describe, expect, it } from "vitest";

import {
  homeViewerResponseCandidateIds,
  viewerResponseForHomeList,
} from "@/domain/events/home-viewer-response";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

describe("home viewer response", () => {
  it("loads every proposed candidate id for multi-time events", () => {
    const ids = homeViewerResponseCandidateIds(
      [
        { id: "a", status: "proposed" },
        { id: "b", status: "proposed" },
      ],
      "proposing",
    );
    expect(ids).toEqual(["a", "b"]);
  });

  it("loads only the selected time for confirmed hui when other proposed rows remain", () => {
    const ids = homeViewerResponseCandidateIds(
      [
        { id: "picked", status: "selected" },
        { id: "alt-a", status: "proposed" },
        { id: "alt-b", status: "proposed" },
      ],
      "confirmed",
    );
    expect(ids).toEqual(["picked"]);
  });

  it("treats a confirmed hui with a saved yes on the selected time as answered", () => {
    const responses = new Map<string, AvailabilityChoice>([["picked", "available"]]);
    expect(
      viewerResponseForHomeList(
        [
          { id: "picked", status: "selected" },
          { id: "alt-a", status: "proposed" },
          { id: "alt-b", status: "proposed" },
        ],
        "confirmed",
        responses,
      ),
    ).toBe("available");
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
