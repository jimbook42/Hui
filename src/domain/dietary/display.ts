import type { DietaryCategory } from "@/domain/dietary/validation";

export function dietaryCategoryLabel(category: DietaryCategory): string {
  switch (category) {
    case "requirement":
      return "Requirement";
    case "allergy":
      return "Allergy or intolerance";
    case "preference":
      return "Preference";
    case "dislike":
      return "Dislike";
    default:
      return category;
  }
}

export function formatSharedDietaryLine(
  displayName: string,
  label: string,
  notes: string | null,
): string {
  const detail = notes ? ` (${notes})` : "";
  return `${displayName} — ${label}${detail}`;
}

export function sharedDietaryReminder(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  const noun = count === 1 ? "requirement" : "requirements";
  return `${count} shared dietary ${noun} may need consideration.`;
}
