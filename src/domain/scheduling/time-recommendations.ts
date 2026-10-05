import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import {
  addDaysToDateOnly,
  compareDateOnly,
  isDateOnly,
  subtractDaysFromDateOnly,
} from "@/domain/recurrence/date-only";
import type { StandingAvailabilityWindow } from "@/domain/scheduling/standing-availability";
import { inferStandingAvailabilitySignal } from "@/domain/scheduling/standing-availability";

/** Maximum suggested slots returned to the proposer. */
export const MAX_TIME_RECOMMENDATIONS = 3;

export type EventAvailabilityResponse = "yes" | "no" | "maybe";

export type MemberRecommendationProfile = {
  userId: string;
  standingWindows: StandingAvailabilityWindow[];
};

export type EventResponseLookup = (
  userId: string,
  candidate: TimeRecommendationCandidate,
) => EventAvailabilityResponse | null;

export type TimeRecommendationCandidate = {
  startsAt: string;
  endsAt: string | null;
};

export type TimeRecommendation = TimeRecommendationCandidate & {
  explanation: string;
};

export type RankTimeRecommendationsInput = {
  memberCount: number;
  members: MemberRecommendationProfile[];
  timeZone: string;
  planningTargetDate: string | null;
  todayDateOnly: string;
  /** Existing proposed times — never duplicated in output. */
  existingCandidates: TimeRecommendationCandidate[];
  maybeResponsesEnabled: boolean;
  /** Per-slot event responses (dominate standing availability). */
  eventResponseForSlot?: EventResponseLookup;
};

type MemberSlotSignal = "available" | "maybe" | "unavailable" | "unknown";

/**
 * Resolve one member's signal for a candidate.
 * Event-specific response dominates standing availability; unknown is not unavailable.
 */
export function resolveMemberSlotSignal(
  member: MemberRecommendationProfile,
  eventResponse: EventAvailabilityResponse | null,
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
  maybeResponsesEnabled = true,
): MemberSlotSignal {
  if (eventResponse === "yes") {
    return "available";
  }
  if (eventResponse === "no") {
    return "unavailable";
  }
  if (eventResponse === "maybe") {
    return maybeResponsesEnabled ? "maybe" : "unknown";
  }

  const standing = inferStandingAvailabilitySignal(
    member.standingWindows,
    startsAt,
    endsAt,
    timeZone,
  );
  if (standing === "usually_unavailable") {
    return "unavailable";
  }
  if (standing === "usually_available") {
    return "available";
  }
  return "unknown";
}

type SlotScore = {
  candidate: TimeRecommendationCandidate;
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  unknownCount: number;
  explicitYesCount: number;
  explicitNoCount: number;
  explicitMaybeCount: number;
  standingAvailableCount: number;
  daysFromTarget: number;
};

function localDateOnly(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function localDayOfWeek(iso: string, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(
    new Date(iso),
  );
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function defaultWallClockTimesForDay(dayOfWeek: number): string[] {
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return ["11:00", "12:00", "17:00", "18:00"];
  }
  return ["18:00", "18:30", "19:00"];
}

/**
 * Generate candidate instants inside the planning window around the nominal target.
 * Does not scan arbitrary months — bounded to a small day range.
 */
export function generateRecommendationCandidates(input: {
  planningTargetDate: string | null;
  todayDateOnly: string;
  timeZone: string;
}): TimeRecommendationCandidate[] {
  const { planningTargetDate, todayDateOnly, timeZone } = input;
  if (!isDateOnly(todayDateOnly)) {
    return [];
  }

  let windowStart: string;
  let windowEnd: string;
  if (planningTargetDate && isDateOnly(planningTargetDate)) {
    windowStart = subtractDaysFromDateOnly(planningTargetDate, 3);
    windowEnd = addDaysToDateOnly(planningTargetDate, 3);
  } else {
    windowStart = addDaysToDateOnly(todayDateOnly, 1);
    windowEnd = addDaysToDateOnly(todayDateOnly, 14);
  }

  if (compareDateOnly(windowStart, todayDateOnly) < 0) {
    windowStart = todayDateOnly;
  }

  const candidates: TimeRecommendationCandidate[] = [];
  let cursor = windowStart;
  let guard = 0;
  while (compareDateOnly(cursor, windowEnd) <= 0 && guard < 32) {
    const probe = wallClockToUtcIso(`${cursor}T12:00`, timeZone);
    const dow = probe ? localDayOfWeek(probe, timeZone) : 0;
    for (const time of defaultWallClockTimesForDay(dow)) {
      const startsAt = wallClockToUtcIso(`${cursor}T${time}`, timeZone);
      if (!startsAt) {
        continue;
      }
      candidates.push({ startsAt, endsAt: null });
    }
    cursor = addDaysToDateOnly(cursor, 1);
    guard += 1;
  }

  return candidates;
}

function candidateKey(candidate: TimeRecommendationCandidate): string {
  return `${candidate.startsAt}|${candidate.endsAt ?? ""}`;
}

function scoreSlot(
  candidate: TimeRecommendationCandidate,
  members: MemberRecommendationProfile[],
  timeZone: string,
  planningTargetDate: string | null,
  eventResponseForSlot?: EventResponseLookup,
  maybeResponsesEnabled = true,
): SlotScore {
  let availableCount = 0;
  let maybeCount = 0;
  let unavailableCount = 0;
  let unknownCount = 0;
  let explicitYesCount = 0;
  let explicitNoCount = 0;
  let explicitMaybeCount = 0;
  let standingAvailableCount = 0;

  for (const member of members) {
    const eventResponse =
      eventResponseForSlot?.(member.userId, candidate) ?? null;
    const signal = resolveMemberSlotSignal(
      member,
      eventResponse,
      candidate.startsAt,
      candidate.endsAt,
      timeZone,
      maybeResponsesEnabled,
    );
    if (eventResponse === "yes") {
      explicitYesCount += 1;
    } else if (eventResponse === "no") {
      explicitNoCount += 1;
    } else if (eventResponse === "maybe") {
      explicitMaybeCount += 1;
    } else if (
      inferStandingAvailabilitySignal(
        member.standingWindows,
        candidate.startsAt,
        candidate.endsAt,
        timeZone,
      ) === "usually_available"
    ) {
      standingAvailableCount += 1;
    }

    switch (signal) {
      case "available":
        availableCount += 1;
        break;
      case "maybe":
        maybeCount += 1;
        break;
      case "unavailable":
        unavailableCount += 1;
        break;
      default:
        unknownCount += 1;
        break;
    }
  }

  const candidateDate = localDateOnly(candidate.startsAt, timeZone);
  const daysFromTarget =
    planningTargetDate && isDateOnly(planningTargetDate)
      ? Math.min(
          99,
          Math.abs(
            (new Date(`${candidateDate}T00:00:00Z`).getTime() -
              new Date(`${planningTargetDate}T00:00:00Z`).getTime()) /
              86_400_000,
          ),
        )
      : 0;

  return {
    candidate,
    availableCount,
    maybeCount,
    unavailableCount,
    unknownCount,
    explicitYesCount,
    explicitNoCount,
    explicitMaybeCount,
    standingAvailableCount,
    daysFromTarget,
  };
}

function compareScores(a: SlotScore, b: SlotScore): number {
  const aLikely = a.availableCount + (a.maybeCount > 0 ? 0.25 : 0);
  const bLikely = b.availableCount + (b.maybeCount > 0 ? 0.25 : 0);
  if (bLikely !== aLikely) {
    return bLikely - aLikely;
  }
  if (a.unavailableCount !== b.unavailableCount) {
    return a.unavailableCount - b.unavailableCount;
  }
  if (a.explicitYesCount !== b.explicitYesCount) {
    return b.explicitYesCount - a.explicitYesCount;
  }
  if (a.standingAvailableCount !== b.standingAvailableCount) {
    return b.standingAvailableCount - a.standingAvailableCount;
  }
  if (a.daysFromTarget !== b.daysFromTarget) {
    return a.daysFromTarget - b.daysFromTarget;
  }
  return a.candidate.startsAt.localeCompare(b.candidate.startsAt);
}

export function explainTimeRecommendation(
  score: SlotScore,
  memberCount: number,
  planningTargetDate: string | null,
): string {
  if (score.explicitYesCount > 0 && score.explicitNoCount === 0) {
    if (score.explicitYesCount === 1) {
      return "1 person has confirmed availability";
    }
    return `${score.explicitYesCount} people have confirmed availability`;
  }

  const responded = score.explicitYesCount + score.explicitMaybeCount + score.explicitNoCount;
  if (responded > 0 && score.explicitNoCount === 0) {
    if (responded === 1) {
      return "1 person has responded; no known conflicts";
    }
    return `${responded} people have responded; no known conflicts`;
  }

  const majority = Math.ceil(memberCount * 0.6);
  if (score.standingAvailableCount >= majority && score.unavailableCount === 0) {
    return "Good match with usual availability";
  }
  if (score.availableCount >= majority) {
    return "Works for most of the group";
  }

  if (
    planningTargetDate &&
    score.daysFromTarget === 0 &&
    score.unavailableCount <= Math.floor(memberCount / 3)
  ) {
    return "Best match for the current planning window";
  }

  if (score.standingAvailableCount > score.unavailableCount) {
    return "Matches usual availability for most members";
  }

  if (score.availableCount > 0 && score.unavailableCount === 0) {
    return "No known conflicts so far";
  }

  return "Works for most of the group";
}

/**
 * Deterministic ranking of a small set of explainable time recommendations.
 * Output never includes per-member availability or standing windows.
 */
export function rankTimeRecommendations(
  input: RankTimeRecommendationsInput,
): TimeRecommendation[] {
  if (input.memberCount < 1 || input.members.length < 1) {
    return [];
  }

  const existing = new Set(input.existingCandidates.map(candidateKey));
  const generated = generateRecommendationCandidates({
    planningTargetDate: input.planningTargetDate,
    todayDateOnly: input.todayDateOnly,
    timeZone: input.timeZone,
  });

  const pool = generated.filter((candidate) => !existing.has(candidateKey(candidate)));
  if (pool.length === 0) {
    return [];
  }

  const scored = pool
    .map((candidate) =>
      scoreSlot(
        candidate,
        input.members,
        input.timeZone,
        input.planningTargetDate,
        input.eventResponseForSlot,
        input.maybeResponsesEnabled,
      ),
    )
    .filter((score) => score.explicitNoCount < input.memberCount)
    .sort(compareScores);

  const recommendations: TimeRecommendation[] = [];
  for (const score of scored) {
    if (recommendations.length >= MAX_TIME_RECOMMENDATIONS) {
      break;
    }
    if (score.availableCount === 0 && score.standingAvailableCount === 0 && score.explicitYesCount === 0) {
      continue;
    }
    if (score.unavailableCount > score.availableCount + score.maybeCount) {
      continue;
    }
    recommendations.push({
      ...score.candidate,
      explanation: explainTimeRecommendation(
        score,
        input.memberCount,
        input.planningTargetDate,
      ),
    });
  }

  return recommendations;
}

/** For tests: ensure recommendation payloads never leak member-level inputs. */
export function recommendationPayloadIsAggregateOnly(
  recommendations: TimeRecommendation[],
): boolean {
  const serialized = JSON.stringify(recommendations);
  return !serialized.includes("userId") && !serialized.includes("standingWindows");
}
