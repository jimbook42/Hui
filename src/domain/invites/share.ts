export const INVITE_SHARE_TITLE = "Join our Hui";
export const INVITE_SHARE_TEXT = "Join our Hui group on Hui.";

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

export async function shareOrCopyInviteLink(url: string): Promise<ShareInviteResult> {
  if (canUseWebShare()) {
    try {
      await navigator.share({
        title: INVITE_SHARE_TITLE,
        text: INVITE_SHARE_TEXT,
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
