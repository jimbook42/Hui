const LABEL_MIN = 1;
const LABEL_MAX = 120;
const NOTES_MIN = 1;
const NOTES_MAX = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DIETARY_CATEGORIES = [
  "requirement",
  "allergy",
  "preference",
  "dislike",
] as const;

export type DietaryCategory = (typeof DIETARY_CATEGORIES)[number];

export function parseDietaryCategory(input: string): DietaryCategory | null {
  const value = input.trim() as DietaryCategory;
  return DIETARY_CATEGORIES.includes(value) ? value : null;
}

export function normalizeDietaryLabel(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < LABEL_MIN || trimmed.length > LABEL_MAX) {
    return null;
  }
  return trimmed;
}

/** Optional detail; empty string becomes null. */
export function normalizeDietaryNotes(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length < NOTES_MIN || trimmed.length > NOTES_MAX) {
    return null;
  }
  return trimmed;
}

export function parseDietaryEntryId(input: string): string | null {
  const trimmed = input.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export function parseGroupId(input: string): string | null {
  const trimmed = input.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export const DIETARY_LABEL_LENGTH = { min: LABEL_MIN, max: LABEL_MAX };
export const DIETARY_NOTES_LENGTH = { min: NOTES_MIN, max: NOTES_MAX };
