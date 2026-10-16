import { describe, expect, it } from "vitest";

import { initialHostVenueMode, resolvedHostVenueSubmission } from "./host-venue";

const home = {
  label: "12 Home St",
  coordinates: { lat: -36.85, lng: 174.76 },
};

describe("host venue mode", () => {
  it("defaults to home when the host has a saved address and no event place yet", () => {
    expect(initialHostVenueMode(home, null, null)).toBe("home");
  });

  it("resolves submission fields from saved home when mode is home", () => {
    expect(
      resolvedHostVenueSubmission("home", home, "", null),
    ).toEqual({
      location: "12 Home St",
      coordinates: home.coordinates,
    });
  });

  it("keeps elsewhere fields when mode is somewhere else", () => {
    expect(
      resolvedHostVenueSubmission("elsewhere", home, "Park", { lat: -41, lng: 175 }),
    ).toEqual({
      location: "Park",
      coordinates: { lat: -41, lng: 175 },
    });
  });
});
