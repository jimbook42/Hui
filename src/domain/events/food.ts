export type EventFoodInvolvement = "yes" | "no" | "unsure";

export const EVENT_FOOD_INVOLVEMENT_VALUES = ["yes", "no", "unsure"] as const;

export function parseEventFoodInvolvement(raw: unknown): EventFoodInvolvement | null {
  if (raw === "yes" || raw === "no" || raw === "unsure") {
    return raw;
  }
  return null;
}

/** Legacy events without a value still surface dietary coordination. */
export function isDietaryCoordinationRelevant(foodInvolvement: EventFoodInvolvement | null): boolean {
  return foodInvolvement !== "no";
}
