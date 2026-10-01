import { describe, expect, it } from "vitest";

import { getHuiWebManifest } from "./manifest";

describe("getHuiWebManifest", () => {
  it("includes required installability fields", () => {
    const manifest = getHuiWebManifest();

    expect(manifest.name).toBe("Hui");
    expect(manifest.short_name).toBe("Hui");
    expect(manifest.description).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

    const png192 = manifest.icons?.find(
      (icon) => icon.sizes === "192x192" && icon.type === "image/png",
    );
    expect(png192?.src).toMatch(/icon-192\.png$/);
  });
});
