import { describe, expect, it } from "vitest";

import { OPENFREEMAP_STYLES, mapStyleFor, resolveMapConfig } from "./config";

describe("map provider configuration", () => {
  it("defaults to OpenFreeMap styles with no API key", () => {
    const config = resolveMapConfig({});
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("openfreemap");
    expect(config.styles).toEqual(OPENFREEMAP_STYLES);
    expect(mapStyleFor(config, "dark")).toContain("openfreemap.org");
  });

  it("never points at the public OpenStreetMap tile servers by default", () => {
    const config = resolveMapConfig({});
    for (const url of Object.values(config.styles)) {
      expect(url).not.toContain("tile.openstreetmap.org");
      expect(url).not.toContain("nominatim");
    }
  });

  it("can be switched off", () => {
    expect(resolveMapConfig({ enabled: "false" }).enabled).toBe(false);
    expect(resolveMapConfig({ enabled: " FALSE " }).enabled).toBe(false);
  });

  it("uses custom style URLs and appends the API key when missing", () => {
    const config = resolveMapConfig({
      provider: "custom",
      styleLightUrl: "https://maps.example.com/styles/hui-light/style.json",
      styleDarkUrl: "https://maps.example.com/styles/hui-dark/style.json?key=existing",
      apiKey: "secret",
    });
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("custom");
    expect(config.styles.light).toBe("https://maps.example.com/styles/hui-light/style.json?key=secret");
    expect(config.styles.dark).toBe("https://maps.example.com/styles/hui-dark/style.json?key=existing");
  });

  it("falls back to the light style when no dark style is given", () => {
    const config = resolveMapConfig({
      provider: "custom",
      styleLightUrl: "https://maps.example.com/light.json",
    });
    expect(config.styles.dark).toBe(config.styles.light);
  });

  it("disables the map when a custom provider is misconfigured instead of silently switching provider", () => {
    expect(resolveMapConfig({ provider: "custom" }).enabled).toBe(false);
    expect(
      resolveMapConfig({ provider: "custom", styleLightUrl: "http://insecure.example.com/s.json" })
        .enabled,
    ).toBe(false);
    expect(resolveMapConfig({ provider: "custom", styleLightUrl: "not a url" }).enabled).toBe(false);
  });
});
