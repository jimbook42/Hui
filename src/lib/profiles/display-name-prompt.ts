import { normalizeDisplayName } from "./validation";

export const DISPLAY_NAME_CONFIRMED_METADATA_KEY = "display_name_confirmed";

export function emailLocalPart(email: string | undefined): string | null {
  if (!email?.includes("@")) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return null;
  }
  return normalizeDisplayName(local) ?? local;
}

export function displayNameMatchesEmailPrefix(
  displayName: string,
  email: string | undefined,
): boolean {
  const prefix = emailLocalPart(email);
  const normalized = normalizeDisplayName(displayName);
  if (!prefix || !normalized) {
    return false;
  }
  return normalized.toLowerCase() === prefix.toLowerCase();
}

export function isDisplayNameConfirmedInMetadata(
  metadata: Record<string, unknown> | undefined,
): boolean {
  return metadata?.[DISPLAY_NAME_CONFIRMED_METADATA_KEY] === true;
}

export function shouldPromptForDisplayName(input: {
  displayName: string | null | undefined;
  email: string | undefined;
  userMetadata: Record<string, unknown> | undefined;
}): boolean {
  if (isDisplayNameConfirmedInMetadata(input.userMetadata)) {
    return false;
  }
  const trimmed = input.displayName?.trim();
  if (!trimmed) {
    return false;
  }
  return displayNameMatchesEmailPrefix(trimmed, input.email);
}

export function bestGuessDisplayNameForPrompt(
  displayName: string | null | undefined,
  email: string | undefined,
): string {
  const trimmed = displayName?.trim();
  if (trimmed) {
    return trimmed;
  }
  return emailLocalPart(email) ?? "Member";
}
