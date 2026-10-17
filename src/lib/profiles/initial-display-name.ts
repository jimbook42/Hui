import { personNameFromAuthMetadata } from "./auth-metadata-display-name";
import { emailLocalPart } from "./display-name-prompt";
import { normalizeDisplayName } from "./validation";

/**
 * Resolves the display name for a new profile from Supabase auth user metadata.
 * Used when the app inserts a missing profile row; the DB trigger uses the same precedence.
 *
 * Provider name metadata is only for initial profile creation — never overwrite an existing profile.
 */
export function initialDisplayNameFromAuthMetadata(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string {
  const fromProvider = personNameFromAuthMetadata(metadata);
  if (fromProvider) {
    return fromProvider;
  }
  const fromEmail = emailLocalPart(email);
  if (fromEmail) {
    return fromEmail;
  }
  return "Member";
}
