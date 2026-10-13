import { describe, expect, it } from "vitest";

import {
  hasConfirmableEventPlace,
  hostAcceptPlaceHeading,
  hostPlaceRequiredOnAccept,
} from "./host-place";

describe("host place on accept", () => {
  it("requires place only when hosting is enabled and the event flag allows it", () => {
    expect(hostPlaceRequiredOnAccept(false, true)).toBe(false);
    expect(hostPlaceRequiredOnAccept(false, false)).toBe(false);
    expect(hostPlaceRequiredOnAccept(true, null)).toBe(false);
    expect(hostPlaceRequiredOnAccept(true, true)).toBe(true);
    expect(hostPlaceRequiredOnAccept(true, false)).toBe(false);
  });

  it("treats written place or a pin as confirmable", () => {
    expect(hasConfirmableEventPlace("  Park  ", null)).toBe(true);
    expect(hasConfirmableEventPlace("", { lat: -41.28, lng: 174.77 })).toBe(true);
    expect(hasConfirmableEventPlace("", null)).toBe(false);
  });

  it("labels the accept step from existing place data", () => {
    expect(hostAcceptPlaceHeading("Alex's", null)).toBe("Confirm this place");
    expect(hostAcceptPlaceHeading("", null)).toBe("Choose a place");
  });
});
