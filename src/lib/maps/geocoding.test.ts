import { describe, expect, it } from "vitest";

import { parseGeocodeProximityFromSearchParams } from "./geocoding";

describe("parseGeocodeProximityFromSearchParams", () => {
  it("returns undefined when either param is missing", () => {
    expect(parseGeocodeProximityFromSearchParams(null, null)).toBeUndefined();
    expect(parseGeocodeProximityFromSearchParams("-41.2", null)).toBeUndefined();
    expect(parseGeocodeProximityFromSearchParams(null, "174.7")).toBeUndefined();
  });

  it("parses valid coordinates", () => {
    expect(parseGeocodeProximityFromSearchParams("-41.2865", "174.7762")).toEqual({
      lat: -41.2865,
      lng: 174.7762,
    });
  });

  it("rejects out-of-range values", () => {
    expect(parseGeocodeProximityFromSearchParams("91", "0")).toBeUndefined();
    expect(parseGeocodeProximityFromSearchParams("0", "181")).toBeUndefined();
    expect(parseGeocodeProximityFromSearchParams("not-a-number", "0")).toBeUndefined();
  });
});
