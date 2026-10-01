const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 120;

/** Normalises and validates group name (matches DB check). */
export function normalizeGroupName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}

export const GROUP_NAME_LENGTH = { min: MIN_NAME_LENGTH, max: MAX_NAME_LENGTH };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUserId(input: string): string | null {
  const trimmed = input.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}
