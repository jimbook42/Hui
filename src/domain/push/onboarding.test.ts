import { describe, expect, it } from "vitest";

import {
  PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS,
  isPushOnboardDismissed,
  shouldShowPushOnboardCard,
} from "./onboarding";

const NOW = Date.UTC(2026, 9, 5);
const DAY = 24 * 60 * 60 * 1000;

const ready = {
  installed: true,
  permission: "default" as const,
  dismissedAt: null,
  now: NOW,
  configured: true,
  supported: true,
  deviceSubscribed: false,
  webPushEnabled: false,
};

describe("isPushOnboardDismissed", () => {
  it("respects the cooldown window", () => {
    const dismissedAt = NOW - (PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS - 1) * DAY;
    expect(isPushOnboardDismissed(dismissedAt, NOW)).toBe(true);
    expect(isPushOnboardDismissed(NOW - PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS * DAY, NOW)).toBe(false);
  });
});

describe("shouldShowPushOnboardCard", () => {
  it("shows enable prompt when installed and permission is default", () => {
    expect(shouldShowPushOnboardCard(ready)).toBe("enable-prompt");
  });

  it("hides when not installed or push is not configured", () => {
    expect(shouldShowPushOnboardCard({ ...ready, installed: false })).toBe(false);
    expect(shouldShowPushOnboardCard({ ...ready, configured: false })).toBe(false);
    expect(shouldShowPushOnboardCard({ ...ready, supported: false })).toBe(false);
  });

  it("hides when already subscribed on this device", () => {
    expect(
      shouldShowPushOnboardCard({
        ...ready,
        permission: "granted",
        deviceSubscribed: true,
        webPushEnabled: true,
      }),
    ).toBe(false);
  });

  it("shows denied hint without re-prompting", () => {
    expect(shouldShowPushOnboardCard({ ...ready, permission: "denied" })).toBe("denied-hint");
  });

  it("hides after dismiss", () => {
    expect(
      shouldShowPushOnboardCard({
        ...ready,
        dismissedAt: NOW - DAY,
      }),
    ).toBe(false);
  });

  it("still offers enable when permission granted but device not subscribed", () => {
    expect(
      shouldShowPushOnboardCard({
        ...ready,
        permission: "granted",
        deviceSubscribed: false,
      }),
    ).toBe("enable-prompt");
  });
});
