import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/ui/theme";

export const THEME_CHANGE_EVENT = "hui-theme-change";

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Apply preference to `<html data-theme>` and notify subscribers. */
export function applyThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage can be blocked; the theme still changes for this page view.
  }
  document.documentElement.setAttribute(
    "data-theme",
    resolveTheme(preference, systemPrefersDark()),
  );
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Re-resolve when OS scheme changes and preference is System. */
export function syncThemeWithSystemIfNeeded(): void {
  if (readThemePreference() !== "system") {
    return;
  }
  document.documentElement.setAttribute(
    "data-theme",
    resolveTheme("system", systemPrefersDark()),
  );
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
