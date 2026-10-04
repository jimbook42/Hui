"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SparkIcon, SunIcon } from "@/components/hui/icons";
import {
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/ui/theme";
import { cn } from "@/lib/ui/cn";

const CHANGE_EVENT = "hui-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function applyPreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage can be blocked; the theme still changes for this page view.
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, prefersDark));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const OPTIONS: Record<ThemePreference, { label: string; icon: React.ReactNode }> = {
  system: { label: "Match device", icon: <SparkIcon size={22} /> },
  light: { label: "Light", icon: <SunIcon size={22} /> },
  dark: { label: "Dark", icon: <MoonIcon size={22} /> },
};

/**
 * Theme preference lives on this device only (localStorage) — no server field, no schema change.
 * The inline head script in the root layout applies it before first paint.
 */
export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);

  return (
    <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-3">
      {THEME_PREFERENCES.map((option) => {
        const selected = preference === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => applyPreference(option)}
            className={cn(
              "hui-focus-ring flex min-h-[5rem] flex-col items-center justify-center gap-1.5 rounded-hui-lg px-2 py-3 text-sm font-extrabold transition duration-200 active:scale-[0.97]",
              selected
                ? "bg-primary text-primary-foreground hui-shadow-md"
                : "bg-muted text-foreground hover:bg-[var(--blob-sage)]",
            )}
          >
            {OPTIONS[option].icon}
            {OPTIONS[option].label}
          </button>
        );
      })}
    </div>
  );
}
