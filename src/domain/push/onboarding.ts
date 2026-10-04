/**
 * Pure rules for the post-install push notification onboarding card.
 */

export const PUSH_ONBOARD_DISMISS_COOLDOWN_DAYS = 30;

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
}): PushOnboardCardMode | false {
  if (!input.configured || !input.supported || !input.installed) {
    return false;
  }
  if (isPushOnboardDismissed(input.dismissedAt, input.now)) {
    return false;
  }
  if (input.webPushEnabled && input.deviceSubscribed) {
    return false;
  }
  if (input.permission === "denied") {
    return "denied-hint";
  }
  if (input.permission === "default") {
    return "enable-prompt";
  }
  if (input.permission === "granted" && !input.deviceSubscribed) {
    return "enable-prompt";
  }
  return false;
}
