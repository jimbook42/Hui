import { describe, expect, it, vi } from "vitest";

import { readThemePreference, syncThemeWithSystemIfNeeded } from "@/lib/ui/theme-client";

describe("theme client", () => {
  it("defaults to system when nothing is stored", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    });
    expect(readThemePreference()).toBe("system");
    vi.unstubAllGlobals();
  });

  it("follows OS scheme when preference is system", () => {
    const setAttribute = vi.fn();
    const matchMedia = (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const storage = {
      getItem: () => null,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("document", { documentElement: { setAttribute } });
    vi.stubGlobal("window", { localStorage: storage, matchMedia, dispatchEvent: vi.fn() });
    syncThemeWithSystemIfNeeded();
    expect(setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    vi.unstubAllGlobals();
  });

  it("does not override explicit light when OS is dark", () => {
    const setAttribute = vi.fn();
    const matchMedia = () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const storage = {
      getItem: () => "light",
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("document", { documentElement: { setAttribute } });
    vi.stubGlobal("window", { localStorage: storage, matchMedia, dispatchEvent: vi.fn() });
    syncThemeWithSystemIfNeeded();
    expect(setAttribute).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
