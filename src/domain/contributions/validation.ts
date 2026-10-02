const CATEGORY_NAME_MIN = 1;
const CATEGORY_NAME_MAX = 60;
const CONTRIBUTION_LABEL_MAX = 160;

export function normalizeCategoryName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < CATEGORY_NAME_MIN || trimmed.length > CATEGORY_NAME_MAX) {
    return null;
  }
  return trimmed;
}

export function normalizeContributionDescription(
  raw: string,
  categoryName: string,
): string | null {
  const trimmed = raw.trim();
  const label = trimmed.length === 0 ? categoryName.trim() : trimmed;
  if (label.length < 1 || label.length > CONTRIBUTION_LABEL_MAX) {
    return null;
  }
  return label;
}

export function normalizeContributionLabelUpdate(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > CONTRIBUTION_LABEL_MAX) {
    return null;
  }
  return trimmed;
}
