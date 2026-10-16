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

/** One form field value = one option (trimmed). Empty rows are ignored. */
export function parseDecisionOptionDrafts(rawInputs: string[]): string[] {
  const labels: string[] = [];
  for (const raw of rawInputs) {
    const label = normalizeDecisionOptionLabel(raw);
    if (label) {
      labels.push(label);
    }
  }
  return labels;
}

export function validateDecisionOptionInputs(rawInputs: string[]): string | null {
  const labels = parseDecisionOptionDrafts(rawInputs);
  if (labels.length < MIN_OPTIONS) {
    return "Add at least two options.";
  }
  if (labels.length > MAX_OPTIONS) {
    return "At most twelve options are allowed.";
  }
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) {
      return "Each option must be unique.";
    }
    seen.add(key);
  }
  for (const label of labels) {
    if (!normalizeDecisionOptionLabel(label)) {
      return "Each option must be between 1 and 120 characters.";
    }
  }
  return null;
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
  const seen = new Set<string>();
  for (const label of optionLabels) {
    if (!normalizeDecisionOptionLabel(label)) {
      return "Each option must be between 1 and 120 characters.";
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      return "Each option must be unique.";
    }
    seen.add(key);
  }
  return null;
}
