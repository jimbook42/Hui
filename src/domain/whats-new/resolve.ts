import { whatsNewForVersion } from "@/domain/whats-new/releases";

export const WHATS_NEW_STORAGE_KEY = "hui_whats_new_last_seen_version";

export type WhatsNewResolveInput = {
  currentVersion: string;
  lastSeenVersion: string | null;
};

export type WhatsNewResolveResult =
  | { action: "hide" }
  | { action: "mark_seen_without_show"; version: string }
  | { action: "show"; version: string };

/**
 * New installs: no backlog — record current version without showing older notes.
 * Upgrades: show at most the current version's note when it has an entry and was not seen yet.
 */
export function resolveWhatsNew(input: WhatsNewResolveInput): WhatsNewResolveResult {
  const entry = whatsNewForVersion(input.currentVersion);
  if (!entry) {
    return { action: "hide" };
  }

  if (input.lastSeenVersion === null) {
    return { action: "mark_seen_without_show", version: input.currentVersion };
  }

  if (input.lastSeenVersion === input.currentVersion) {
    return { action: "hide" };
  }

  return { action: "show", version: input.currentVersion };
}
