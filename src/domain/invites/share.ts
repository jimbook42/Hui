export const INVITE_SHARE_TITLE = "Join our group on Hui";
export const INVITE_SHARE_TEXT = "You're invited to join our group on Hui.";

export function inviteShareTitle(groupName?: string): string {
  if (groupName?.trim()) {
    return `Join ${groupName.trim()} on Hui`;
  }
  return INVITE_SHARE_TITLE;
}

export function inviteShareText(groupName?: string): string {
  if (groupName?.trim()) {
    return `You're invited to join ${groupName.trim()} on Hui.`;
  }
  return INVITE_SHARE_TEXT;
}

export type ShareInviteResult =
  | { outcome: "shared" }
  | { outcome: "copied" }
  | { outcome: "cancelled" }
  | { outcome: "failed"; message: string };

export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function copyInviteLink(url: string): Promise<ShareInviteResult> {
  try {
    await navigator.clipboard.writeText(url);
    return { outcome: "copied" };
  } catch {
    return { outcome: "failed", message: "Could not copy the invite link." };
  }
}

export async function shareOrCopyInviteLink(
  url: string,
  groupName?: string,
): Promise<ShareInviteResult> {
  if (canUseWebShare()) {
    try {
      await navigator.share({
        title: inviteShareTitle(groupName),
        text: inviteShareText(groupName),
        url,
      });
      return { outcome: "shared" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { outcome: "cancelled" };
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { outcome: "copied" };
  } catch {
    return { outcome: "failed", message: "Could not copy the invite link." };
  }
}
