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

const GATHERING_DEFAULT_EVENT_TITLES: Record<GatheringType, string> = {
  dinner_meal: "Dinner",
  golf: "Golf",
  drinks_night_out: "Drinks",
  game_night: "Game night",
  trip_outing: "Outing",
  meeting: "Meeting",
  other: "Gathering",
};

/** Stored event title when the organiser skips an optional gathering name. */
export function defaultGatheringEventTitle(
  type: GatheringType,
  customDescription: string | null,
): string {
  if (type === "other") {
    return customDescription?.trim() || GATHERING_DEFAULT_EVENT_TITLES.other;
  }
  return GATHERING_DEFAULT_EVENT_TITLES[type];
}

/** Optional human-readable name for invite copy — not the internal fallback title. */
export function gatheringEventTitleForInvite(
  storedTitle: string | null,
  type: GatheringType | null,
  customDescription: string | null,
): string | null {
  const trimmed = storedTitle?.trim() ?? "";
  if (!trimmed || !type) {
    return null;
  }
  if (type === "other") {
    const custom = customDescription?.trim() ?? "";
    return trimmed === custom ? null : trimmed;
  }
  return trimmed === defaultGatheringEventTitle(type, null) ? null : trimmed;
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

function titleContainsWord(title: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return pattern.test(title);
}

function titleWithSuffix(title: string, suffix: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return suffix;
  }
  if (titleContainsWord(trimmed, suffix) || trimmed.toLowerCase().endsWith(suffix.toLowerCase())) {
    return trimmed;
  }
  return `${trimmed} ${suffix}`;
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
    return title || "this hui";
  }

  if (type === "dinner_meal") {
    if (!title) {
      return "a dinner";
    }
    if (titleContainsWord(title, "dinner") || titleContainsWord(title, "meal")) {
      return title;
    }
    return titleWithSuffix(title, "dinner");
  }
  if (type === "golf") {
    if (!title) {
      return "a round of golf";
    }
    if (titleContainsWord(title, "golf")) {
      return title;
    }
    return titleWithSuffix(title, "round of golf");
  }
  if (type === "drinks_night_out") {
    if (!title) {
      return "a night out";
    }
    if (titleContainsWord(title, "night")) {
      return title;
    }
    return titleWithSuffix(title, "night out");
  }
  if (type === "game_night") {
    if (!title) {
      return "a game night";
    }
    if (titleContainsWord(title, "game")) {
      return title;
    }
    return titleWithSuffix(title, "game night");
  }
  if (type === "trip_outing") {
    if (!title) {
      return "an outing";
    }
    if (titleContainsWord(title, "outing") || titleContainsWord(title, "trip")) {
      return title;
    }
    return titleWithSuffix(title, "outing");
  }
  if (type === "meeting") {
    return title || "this hui";
  }

  return title || "this hui";
}
