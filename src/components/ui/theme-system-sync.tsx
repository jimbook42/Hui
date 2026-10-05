"use client";

import { useEffect } from "react";

import { syncThemeWithSystemIfNeeded } from "@/lib/ui/theme-client";

/**
 * Keeps `data-theme` in sync with OS light/dark when the user chose System.
 * Explicit light/dark selections are left unchanged.
 */
export function ThemeSystemSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncThemeWithSystemIfNeeded();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
