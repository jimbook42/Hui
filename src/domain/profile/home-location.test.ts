import { describe, expect, it } from "vitest";

import { hasUsableHomeLocation, parseHomeLocationForm } from "./home-location";

describe("parseHomeLocationForm", () => {
  it("accepts empty home", () => {
    expect(parseHomeLocationForm("", "", "")).toEqual({ ok: true, home: null });
  });

  it("requires a label when coordinates are set", () => {
    expect(parseHomeLocationForm("", "-36.8", "174.7")).toEqual({
      ok: false,
      error: "Add a name for home so the group knows where you host.",
    });
  });

  it("stores label-only home", () => {
    expect(parseHomeLocationForm("Our place", "", "")).toEqual({
      ok: true,
      home: { label: "Our place", coordinates: null },
    });
  });
});

describe("hasUsableHomeLocation", () => {
  it("is false when missing", () => {
    expect(hasUsableHomeLocation(null)).toBe(false);
    expect(hasUsableHomeLocation({ label: "", coordinates: null })).toBe(false);
  });

  it("is true with label", () => {
    expect(hasUsableHomeLocation({ label: "Home", coordinates: null })).toBe(true);
  });
});
