"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SparkIcon, SunIcon } from "@/components/hui/icons";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/ui/theme";
import {
  THEME_CHANGE_EVENT,
  applyThemePreference,
  readThemePreference,
} from "@/lib/ui/theme-client";
import { cn } from "@/lib/ui/cn";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
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
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as ThemePreference);

  return (
    <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-3">
      {THEME_PREFERENCES.map((option) => {
        const selected = preference === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => applyThemePreference(option)}
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
