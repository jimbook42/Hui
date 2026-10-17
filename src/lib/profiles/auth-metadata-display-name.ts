import { normalizeDisplayName } from "./validation";

function normalizedCandidate(value: unknown): string | null {
  const normalized = normalizeDisplayName(String(value ?? ""));
  return normalized ?? null;
}

function joinGivenFamily(given: unknown, family: unknown): string | null {
  const parts = [given, family]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return normalizeDisplayName(parts.join(" "));
}

function nameFromCustomClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") {
    return null;
  }
  const record = claims as Record<string, unknown>;
  const direct = normalizedCandidate(record.name);
  if (direct) {
    return direct;
  }
  return joinGivenFamily(record.given_name, record.family_name);
}

/**
 * Person-name fields from provider metadata before email-prefix fallback.
 * Does not read `display_name` (user-chosen / email sign-up field).
 */
export function personNameFromAuthMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) {
    return null;
  }

  for (const value of [metadata.full_name, metadata.name]) {
    const normalized = normalizedCandidate(value);
    if (normalized) {
      return normalized;
    }
  }

  const fromGivenFamily = joinGivenFamily(metadata.given_name, metadata.family_name);
  if (fromGivenFamily) {
    return fromGivenFamily;
  }

  const fromClaims = nameFromCustomClaims(metadata.custom_claims);
  if (fromClaims) {
    return fromClaims;
  }

  const chosen = normalizedCandidate(metadata.display_name);
  return chosen;
}
