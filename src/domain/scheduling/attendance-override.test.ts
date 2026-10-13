import { describe, expect, it } from "vitest";

import type { AttendanceRoster } from "./attendance-roster";
import {
  applyViewerOverrideToRoster,
  effectiveViewerResponse,
  responseChangeEffect,
  viewerResponseFromRoster,
} from "./attendance-override";

const roster: AttendanceRoster = {
  maybeResponsesEnabled: true,
  members: [
    { userId: "me", displayName: "Me", response: "yes" },
    { userId: "ann", displayName: "Ann", response: "maybe" },
    { userId: "bo", displayName: "Bo", response: null },
  ],
};

describe("effectiveViewerResponse", () => {
  it("uses the server value without an override", () => {
    expect(effectiveViewerResponse("available", null)).toBe("available");
  });

  it("shows the optimistic choice while the server still has the old value", () => {
    expect(effectiveViewerResponse("available", { choice: "maybe", basedOn: "available" })).toBe(
      "maybe",
    );
  });

  it("defers to fresh server data once it has moved on", () => {
    expect(effectiveViewerResponse("maybe", { choice: "maybe", basedOn: "available" })).toBe(
      "maybe",
    );
    expect(effectiveViewerResponse("unavailable", { choice: "maybe", basedOn: "available" })).toBe(
      "unavailable",
    );
  });

  it("applies to a first answer (no previous response)", () => {
    expect(effectiveViewerResponse(null, { choice: "available", basedOn: null })).toBe("available");
  });
});

describe("applyViewerOverrideToRoster", () => {
  it("returns the same roster when nothing is pending", () => {
    expect(applyViewerOverrideToRoster(roster, "me", null)).toBe(roster);
  });

  it("updates only the viewer's entry and never mutates the original", () => {
    const next = applyViewerOverrideToRoster(roster, "me", { choice: "unavailable", basedOn: "available" });
    expect(next.members.find((m) => m.userId === "me")?.response).toBe("no");
    expect(next.members.find((m) => m.userId === "ann")?.response).toBe("maybe");
    expect(roster.members[0].response).toBe("yes");
  });

  it("fills in a first answer", () => {
    const next = applyViewerOverrideToRoster(roster, "bo", { choice: "maybe", basedOn: null });
    expect(next.members.find((m) => m.userId === "bo")?.response).toBe("maybe");
  });

  it("ignores a stale override", () => {
    expect(
      applyViewerOverrideToRoster(roster, "me", { choice: "maybe", basedOn: "unavailable" }),
    ).toBe(roster);
  });

  it("leaves the roster alone when the viewer is not on it", () => {
    const next = applyViewerOverrideToRoster(roster, "stranger", { choice: "maybe", basedOn: null });
    expect(next.members).toEqual(roster.members);
  });
});

describe("viewerResponseFromRoster", () => {
  it("maps database values to choices", () => {
    expect(viewerResponseFromRoster(roster, "me")).toBe("available");
    expect(viewerResponseFromRoster(roster, "bo")).toBeNull();
  });
});

describe("responseChangeEffect", () => {
  it("flags the follow-ups that matter", () => {
    expect(responseChangeEffect("maybe", "available")).toBe("offer-details");
    expect(responseChangeEffect("available", "unavailable")).toBe("release-contributions");
    expect(responseChangeEffect("available", "maybe")).toBe("update");
    expect(responseChangeEffect("maybe", "maybe")).toBe("none");
  });
});
