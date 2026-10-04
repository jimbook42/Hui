import { describe, expect, it } from "vitest";

import { isThemePreference, resolveTheme, THEME_INIT_SCRIPT } from "./theme";

describe("theme preference", () => {
  it("resolves explicit preferences regardless of system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system when preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("validates stored values", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("ships an init script that sets data-theme", () => {
    expect(THEME_INIT_SCRIPT).toContain("data-theme");
    expect(THEME_INIT_SCRIPT).toContain("hui-theme");
  });
});
