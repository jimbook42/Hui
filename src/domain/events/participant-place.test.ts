import { describe, expect, it } from "vitest";

import { participantPlaceView } from "./participant-place";

describe("participant place (HUI-026B)", () => {
  it("shows event location when set", () => {
    expect(
      participantPlaceView({
        eventStatus: "proposing",
        eventLocation: "12 Park Lane",
        acceptedHostDisplayName: null,
        hostingEnabled: true,
      }),
    ).toEqual({ kind: "known", line: "12 Park Lane" });
  });

  it("does not invent an address for a proposed host", () => {
    expect(
      participantPlaceView({
        eventStatus: "proposing",
        eventLocation: null,
        acceptedHostDisplayName: "Alex",
        hostingEnabled: true,
      }),
    ).toEqual({ kind: "pending", line: "Still being worked out." });
  });

  it("can name accepted host place after confirmation without a location field", () => {
    expect(
      participantPlaceView({
        eventStatus: "confirmed",
        eventLocation: null,
        acceptedHostDisplayName: "Alex",
        hostingEnabled: true,
      }),
    ).toEqual({ kind: "known", line: "At Alex's place" });
  });
});
