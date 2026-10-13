import { describe, expect, it } from "vitest";

import {
  INSTALL_DISMISS_COOLDOWN_DAYS,
  detectInstallPlatform,
  installInstructionsFor,
  isInstallDismissed,
  resolveInstallAvailability,
  shouldShowInstallCard,
} from "./install";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const EDGE = `${CHROME_DESKTOP} Edg/124.0`;
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const NOW = Date.UTC(2026, 9, 5);
const DAY = 24 * 60 * 60 * 1000;

describe("detectInstallPlatform", () => {
  it("recognises the main platforms", () => {
    expect(detectInstallPlatform(IPHONE)).toBe("ios");
    expect(detectInstallPlatform(ANDROID)).toBe("android");
    expect(detectInstallPlatform(CHROME_DESKTOP)).toBe("desktop-chromium");
    expect(detectInstallPlatform(EDGE)).toBe("desktop-chromium");
    expect(detectInstallPlatform(SAFARI_MAC)).toBe("desktop-safari");
    expect(detectInstallPlatform(FIREFOX)).toBe("other");
  });

  it("treats a touch-capable Mac user agent as iPadOS", () => {
    expect(detectInstallPlatform(SAFARI_MAC, 5)).toBe("ios");
  });
});

describe("resolveInstallAvailability", () => {
  it("reports installed first, then native prompt, then manual instructions", () => {
    expect(
      resolveInstallAvailability({ installed: true, hasNativePrompt: true, platform: "ios" }),
    ).toBe("installed");
    expect(
      resolveInstallAvailability({
        installed: false,
        hasNativePrompt: true,
        platform: "desktop-chromium",
      }),
    ).toBe("prompt");
    expect(
      resolveInstallAvailability({ installed: false, hasNativePrompt: false, platform: "ios" }),
    ).toBe("instructions");
    expect(
      resolveInstallAvailability({ installed: false, hasNativePrompt: false, platform: "other" }),
    ).toBe("unsupported");
  });
});

describe("dismissal", () => {
  it("stays dismissed through the cool-down and returns afterwards", () => {
    expect(isInstallDismissed(null, NOW)).toBe(false);
    expect(isInstallDismissed(NOW - 2 * DAY, NOW)).toBe(true);
    expect(isInstallDismissed(NOW - (INSTALL_DISMISS_COOLDOWN_DAYS + 1) * DAY, NOW)).toBe(false);
  });

  it("does not hide forever when the stored time is in the future", () => {
    expect(isInstallDismissed(NOW + DAY, NOW)).toBe(false);
  });
});

describe("shouldShowInstallCard", () => {
  it("shows for a native prompt and for phone instructions", () => {
    expect(
      shouldShowInstallCard({
        availability: "prompt",
        platform: "desktop-chromium",
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      shouldShowInstallCard({
        availability: "instructions",
        platform: "ios",
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("never nags desktop instructions, installed apps, unsupported browsers or after dismissal", () => {
    expect(
      shouldShowInstallCard({
        availability: "instructions",
        platform: "desktop-safari",
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallCard({
        availability: "installed",
        platform: "android",
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallCard({
        availability: "unsupported",
        platform: "other",
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallCard({
        availability: "prompt",
        platform: "android",
        dismissedAt: NOW - DAY,
        now: NOW,
      }),
    ).toBe(false);
  });
});

describe("installInstructionsFor", () => {
  it("never uses the word download", () => {
    for (const platform of [
      "ios",
      "android",
      "desktop-chromium",
      "desktop-safari",
      "other",
    ] as const) {
      const { title, steps } = installInstructionsFor(platform);
      expect(`${title} ${steps.join(" ")}`.toLowerCase()).not.toContain("download");
      expect(steps.length).toBeGreaterThan(0);
    }
  });

  it("uses the home screen wording on phones", () => {
    expect(installInstructionsFor("ios").title).toBe("Add Hui to your home screen");
    expect(installInstructionsFor("android").title).toBe("Add Hui to your home screen");
  });
});
