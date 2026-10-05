export const GATHERING_TYPES = [
  "dinner_meal",
  "golf",
  "drinks_night_out",
  "game_night",
  "trip_outing",
  "meeting",
  "other",
] as const;

export type GatheringType = (typeof GATHERING_TYPES)[number];

export type GatheringContext = {
  type: GatheringType | null;
  customDescription: string | null;
  eventTitle: string | null;
};

const GATHERING_TYPE_LABELS: Record<GatheringType, string> = {
  dinner_meal: "Dinner / meal",
  golf: "Golf",
  drinks_night_out: "Drinks / night out",
  game_night: "Game night",
  trip_outing: "Trip / outing",
  meeting: "Meeting",
  other: "Other",
};

export function gatheringTypeLabel(type: GatheringType): string {
  return GATHERING_TYPE_LABELS[type];
}

export function parseGatheringType(raw: unknown): GatheringType | null {
  if (typeof raw !== "string") {
    return null;
  }
  return GATHERING_TYPES.includes(raw as GatheringType) ? (raw as GatheringType) : null;
}

export function normalizeGatheringCustomDescription(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 80) {
    return null;
  }
  return trimmed;
}

/** Natural phrase for invitations — never inferred from event title. */
export function gatheringPlanningPhrase(context: GatheringContext): string {
  const title = context.eventTitle?.trim() ?? "";
  const type = context.type;

  if (type === "other") {
    const custom = context.customDescription?.trim();
    if (custom) {
      return title ? `${title} (${custom})` : custom;
    }
    return title || "a gathering";
  }

  if (type === "dinner_meal") {
    return title ? `${title} dinner` : "a dinner";
  }
  if (type === "golf") {
    return title ? `${title} round of golf` : "a round of golf";
  }
  if (type === "drinks_night_out") {
    return title ? `${title} night out` : "a night out";
  }
  if (type === "game_night") {
    return title ? `${title} game night` : "a game night";
  }
  if (type === "trip_outing") {
    return title ? `${title} outing` : "an outing";
  }
  if (type === "meeting") {
    return title ? `${title} meeting` : "a meeting";
  }

  return title || "a gathering";
}
