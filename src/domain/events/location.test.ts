import { describe, expect, it } from "vitest";

import {
  buildExternalMapsUrl,
  coordinatesFromRow,
  describeMapLocation,
  isValidCoordinates,
  parseOptionalCoordinates,
  roundCoordinate,
} from "./location";

describe("event location coordinates", () => {
  it("treats both-empty as no pin", () => {
    expect(parseOptionalCoordinates("", "")).toEqual({ ok: true, coordinates: null });
    expect(parseOptionalCoordinates(null, undefined)).toEqual({ ok: true, coordinates: null });
  });

  it("parses and rounds a valid pin", () => {
    const result = parseOptionalCoordinates("-41.2865001234", "174.7762");
    expect(result).toEqual({ ok: true, coordinates: { lat: -41.2865, lng: 174.7762 } });
  });

  it("rejects half a pin, garbage and out-of-range values", () => {
    expect(parseOptionalCoordinates("-41.28", "").ok).toBe(false);
    expect(parseOptionalCoordinates("", "174.77").ok).toBe(false);
    expect(parseOptionalCoordinates("abc", "174.77").ok).toBe(false);
    expect(parseOptionalCoordinates("91", "10").ok).toBe(false);
    expect(parseOptionalCoordinates("10", "-181").ok).toBe(false);
  });

  it("builds coordinates from a row only when both parts are valid", () => {
    expect(coordinatesFromRow(-41.28, 174.77)).toEqual({ lat: -41.28, lng: 174.77 });
    expect(coordinatesFromRow("-41.28", "174.77")).toEqual({ lat: -41.28, lng: 174.77 });
    expect(coordinatesFromRow(null, 174.77)).toBeNull();
    expect(coordinatesFromRow(120, 10)).toBeNull();
  });

  it("validates coordinate objects", () => {
    expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidCoordinates({ lat: 95, lng: 0 })).toBe(false);
    expect(isValidCoordinates(null)).toBe(false);
  });

  it("rounds to six decimals", () => {
    expect(roundCoordinate(1.23456789)).toBe(1.234568);
  });

  it("describes the map for assistive tech", () => {
    expect(describeMapLocation("Alex's place")).toBe("Map showing Alex's place");
    expect(describeMapLocation(null)).toBe("Map showing the pinned spot");
  });

  it("builds external maps links from coordinates or place text", () => {
    expect(buildExternalMapsUrl(null, { lat: -41.28, lng: 174.77 })).toContain("-41.28");
    expect(buildExternalMapsUrl("Central Park", null)).toContain("Central%20Park");
    expect(buildExternalMapsUrl(null, null)).toBeNull();
  });
});
