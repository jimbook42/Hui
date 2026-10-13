const QUESTION_MIN = 1;
const QUESTION_MAX = 200;
const OPTION_MIN = 1;
const OPTION_MAX = 120;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

export function normalizeDecisionQuestion(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < QUESTION_MIN || trimmed.length > QUESTION_MAX) {
    return null;
  }
  return trimmed;
}

export function normalizeDecisionOptionLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < OPTION_MIN || trimmed.length > OPTION_MAX) {
    return null;
  }
  return trimmed;
}

/** Parse newline- or comma-separated draft options from a form field. */
export function parseDecisionOptionDrafts(raw: string): string[] {
  const parts = raw
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const label = normalizeDecisionOptionLabel(part);
    if (label && !unique.includes(label)) {
      unique.push(label);
    }
  }
  return unique;
}

export function validateDecisionDraft(question: string, optionLabels: string[]): string | null {
  if (!normalizeDecisionQuestion(question)) {
    return "Enter a question between 1 and 200 characters.";
  }
  if (optionLabels.length < MIN_OPTIONS) {
    return "Add at least two options.";
  }
  if (optionLabels.length > MAX_OPTIONS) {
    return "At most twelve options are allowed.";
  }
  for (const label of optionLabels) {
    if (!normalizeDecisionOptionLabel(label)) {
      return "Each option must be between 1 and 120 characters.";
    }
  }
  return null;
}
