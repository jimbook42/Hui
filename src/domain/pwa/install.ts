/**
 * Pure rules for the "Add Hui to your home screen" experience. No browser APIs in here so the
 * decisions can be unit tested; the client store feeds them real browser facts.
 */

export type InstallPlatform = "ios" | "android" | "desktop-chromium" | "desktop-safari" | "other";

export type InstallAvailability =
  /** Already running as an installed app, or reported installed. */
  | "installed"
  /** The browser handed us a native install prompt we can trigger. */
  | "prompt"
  /** No native prompt, but this platform can install by hand (we show steps). */
  | "instructions"
  /** Nothing useful to offer. */
  | "unsupported";

/** After "Not now" the dashboard card stays away for this long. Settings is never hidden. */
export const INSTALL_DISMISS_COOLDOWN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Social / messenger in-app browsers cannot install PWAs; user must open in Safari or Chrome. */
export function detectInAppBrowser(userAgent: string): boolean {
  const ua = userAgent || "";
  return (
    /FBAN|FBAV/i.test(ua) ||
    /Instagram/i.test(ua) ||
    /\bLine\//i.test(ua) ||
    /Messenger/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /LinkedInApp/i.test(ua) ||
    /Snapchat/i.test(ua) ||
    /Pinterest/i.test(ua) ||
    /MicroMessenger/i.test(ua) ||
    /; wv\)/i.test(ua)
  );
}

export type InAppBrowserInstallBanner = {
  title: string;
  steps: string[];
};

/** Sign-in from social in-app browsers (Facebook, Instagram, etc.) — Google OAuth needs a real browser. */
export function inAppBrowserOAuthSignInBanner(platform: InstallPlatform): InAppBrowserInstallBanner {
  const openSteps = inAppBrowserInstallBanner(platform);
  return {
    title:
      platform === "ios"
        ? "Open in Safari to sign in"
        : platform === "android"
          ? "Open in Chrome to sign in"
          : "Open in your browser to sign in",
    steps: [
      "Google sign-in does not work inside Facebook, Instagram, and similar in-app browsers.",
      ...openSteps.steps,
    ],
  };
}

export function inAppBrowserInstallBanner(platform: InstallPlatform): InAppBrowserInstallBanner {
  if (platform === "ios") {
    return {
      title: "Open in Safari to install Hui",
      steps: [
        "Tap the menu (\u22ef) in the top or bottom corner.",
        "Choose \u201cOpen in browser\u201d or \u201cOpen in Safari\u201d.",
        "Then add Hui to your home screen from Safari.",
      ],
    };
  }
  if (platform === "android") {
    return {
      title: "Open in Chrome to install Hui",
      steps: [
        "Tap the menu (\u22ef) in the top corner.",
        "Choose \u201cOpen in browser\u201d or \u201cOpen in Chrome\u201d.",
        "Then install Hui from Chrome\u2019s menu.",
      ],
    };
  }
  return {
    title: "Open in your browser to install Hui",
    steps: [
      "Use your browser\u2019s menu (\u22ef) and open this page in Safari, Chrome, or Edge.",
      "Install is not available inside in-app browsers.",
    ],
  };
}

export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent || "";
  // iPadOS 13+ reports as Macintosh; touch points distinguish it from a real Mac.
  const isIpadOs = /Macintosh/.test(ua) && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs) {
    return "ios";
  }
  if (/Android/.test(ua)) {
    return "android";
  }
  if (/Firefox\//.test(ua) && !/Seamonkey/.test(ua)) {
    // Firefox desktop cannot install web apps.
    return "other";
  }
  if (/Edg\/|Chrome\/|Chromium\/|OPR\//.test(ua)) {
    return "desktop-chromium";
  }
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) {
    return "desktop-safari";
  }
  return "other";
}

export function resolveInstallAvailability(input: {
  installed: boolean;
  hasNativePrompt: boolean;
  platform: InstallPlatform;
}): InstallAvailability {
  if (input.installed) {
    return "installed";
  }
  if (input.hasNativePrompt) {
    return "prompt";
  }
  if (input.platform === "other") {
    return "unsupported";
  }
  return "instructions";
}

export function isInstallDismissed(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null || !Number.isFinite(dismissedAt)) {
    return false;
  }
  if (dismissedAt > now) {
    // Clock moved backwards: treat as not dismissed rather than hiding forever.
    return false;
  }
  return now - dismissedAt < INSTALL_DISMISS_COOLDOWN_DAYS * DAY_MS;
}

/** Whether the unobtrusive dashboard card should show. Phones and a real native prompt only. */
export function shouldShowInstallCard(input: {
  availability: InstallAvailability;
  platform: InstallPlatform;
  dismissedAt: number | null;
  now: number;
  /** Number of times the member has opened Hui in this browser (see install-store). */
  visitCount: number;
}): boolean {
  if (input.visitCount < 2) {
    return false;
  }
  if (isInstallDismissed(input.dismissedAt, input.now)) {
    return false;
  }
  if (input.availability === "prompt") {
    return true;
  }
  if (input.availability === "instructions") {
    return input.platform === "ios" || input.platform === "android";
  }
  return false;
}

export type InstallInstructions = {
  title: string;
  steps: string[];
};

export function installInstructionsFor(platform: InstallPlatform): InstallInstructions {
  switch (platform) {
    case "ios":
      return {
        title: "Add Hui to your home screen",
        steps: [
          "Tap the Share button in Safari.",
          "Choose \u201cAdd to Home Screen\u201d.",
          "Tap Add. Hui opens like any other app.",
        ],
      };
    case "android":
      return {
        title: "Add Hui to your home screen",
        steps: [
          "Open your browser menu.",
          "Choose \u201cInstall app\u201d or \u201cAdd to Home screen\u201d.",
          "Confirm. Hui opens like any other app.",
        ],
      };
    case "desktop-chromium":
      return {
        title: "Install Hui",
        steps: [
          "Look for the install icon at the right of the address bar, or open the browser menu.",
          "Choose \u201cInstall Hui\u201d.",
        ],
      };
    case "desktop-safari":
      return {
        title: "Add Hui to your Dock",
        steps: ["In the Safari menu bar choose File.", "Choose \u201cAdd to Dock\u201d."],
      };
    default:
      return {
        title: "Install Hui",
        steps: [
          "This browser can\u2019t install Hui. Try Chrome, Edge or Safari, or just keep using Hui in a tab.",
        ],
      };
  }
}
