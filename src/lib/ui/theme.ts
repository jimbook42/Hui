export const THEME_STORAGE_KEY = "hui-theme";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** Resolve a stored preference to the concrete theme applied on <html data-theme>. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (preference === "light") {
    return "light";
  }
  if (preference === "dark") {
    return "dark";
  }
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Runs before first paint so the correct theme is applied without a flash.
 * Keep in sync with `resolveTheme` / `THEME_STORAGE_KEY`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;
