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
  const candidates = [metadata?.full_name, metadata?.name, metadata?.display_name];
  for (const value of candidates) {
    const normalized = normalizeDisplayName(String(value ?? ""));
    if (normalized) {
      return normalized;
    }
  }
  return normalizeDisplayName(email?.split("@")[0] ?? "") ?? "Member";
}
