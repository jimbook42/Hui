/**
 * Pure rules for the post-install push notification onboarding card.
 */

export const PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PushOnboardCardMode = "enable-prompt" | "denied-hint";

export function isPushOnboardDismissed(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null || !Number.isFinite(dismissedAt)) {
    return false;
  }
  if (dismissedAt > now) {
    return false;
  }
  return now - dismissedAt < PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS * DAY_MS;
}

export function shouldShowPushOnboardCard(input: {
  /** Hui is installed / running standalone (home screen). */
  installed: boolean;
  permission: "default" | "granted" | "denied";
  dismissedAt: number | null;
  now: number;
  configured: boolean;
  supported: boolean;
  deviceSubscribed: boolean;
  webPushEnabled: boolean;
  /** When false, offer notifications before the app is on the home screen (signed-in nudge). */
  requireInstalled?: boolean;
  subscriptionCount?: number;
}): PushOnboardCardMode | false {
  const requireInstalled = input.requireInstalled !== false;
  if (!input.configured || !input.supported) {
    return false;
  }
  if (requireInstalled && !input.installed) {
    return false;
  }
  if (isPushOnboardDismissed(input.dismissedAt, input.now)) {
    return false;
  }
  if (input.permission === "denied") {
    return false;
  }
  if (input.webPushEnabled && input.deviceSubscribed) {
    return false;
  }
  if (input.permission === "default") {
    return "enable-prompt";
  }
  if (input.permission === "granted" && !input.deviceSubscribed) {
    if (!input.webPushEnabled && (input.subscriptionCount ?? 0) > 0) {
      return false;
    }
    return "enable-prompt";
  }
  return false;
}
