const MIN_LENGTH = 1;
const MAX_LENGTH = 80;

/** Normalises and validates display_name for profiles (matches DB check). */
export function normalizeDisplayName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

export const DISPLAY_NAME_LENGTH = { min: MIN_LENGTH, max: MAX_LENGTH };
