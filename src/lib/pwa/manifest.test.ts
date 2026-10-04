import { existsSync } from "node:fs";
import { join } from "node:path";

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

  it("ships separate any and maskable icons at 192 and 512, all real files", () => {
    const icons = getHuiWebManifest().icons ?? [];
    for (const size of ["192x192", "512x512"]) {
      for (const purpose of ["any", "maskable"]) {
        const match = icons.find((icon) => icon.sizes === size && icon.purpose === purpose);
        expect(match, `${purpose} ${size}`).toBeDefined();
        expect(existsSync(join(process.cwd(), "public", match!.src))).toBe(true);
      }
    }
    expect(icons.some((icon) => icon.src.endsWith(".svg"))).toBe(false);
  });

  it("has a stable id and scope", () => {
    const manifest = getHuiWebManifest();
    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
  });
});
