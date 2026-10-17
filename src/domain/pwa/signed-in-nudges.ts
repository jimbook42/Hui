/**
 * Which install / notification nudge to show on signed-in app pages (at most one).
 */

export const SIGNED_IN_NUDGE_SNOOZE_DAYS = 7;

export type SignedInNudgeKind = "install" | "notification";

export function isOnboardingAppPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "";
  if (path === "/profile/setup") {
    return true;
  }
  return /^\/groups\/[^/]+\/welcome$/.test(path);
}

/** Install nudge wins when both are eligible. */
export function pickSignedInNudge(input: {
  installEligible: boolean;
  notificationEligible: boolean;
}): SignedInNudgeKind | false {
  if (input.installEligible) {
    return "install";
  }
  if (input.notificationEligible) {
    return "notification";
  }
  return false;
}
