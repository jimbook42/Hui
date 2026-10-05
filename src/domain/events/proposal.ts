import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import {
  normalizeEventLocation,
  normalizeEventNotes,
  normalizeEventTitle,
  parseCadenceUnit,
  parseIntervalCount,
  parseStartsOnDate,
} from "@/domain/events/validation";
import { isValidCoordinates, type EventCoordinates } from "@/domain/events/location";
import { parseEventFoodInvolvement, type EventFoodInvolvement } from "@/domain/events/food";
import { validateCandidateWindow } from "@/domain/scheduling/validation";

export type ProposalCandidateInput = {
  startsAt: string;
  /** Optional: a proposed time can be start-only. */
  endsAt: string | null;
};

export type ProposalRecurrenceInput = {
  seriesTitle: string;
  intervalUnit: "week" | "month";
  intervalCount: number;
  startsOn: string;
  /** Nominal cycle target — duplicate prevention in propose_group_event. */
  planningTargetDate?: string | null;
};

export type EventProposalDraft = {
  title: string;
  location: string;
  /** Optional pin chosen on the map. Independent of the place text. */
  locationCoordinates?: EventCoordinates | null;
  notes: string;
  eventKind: "one_off" | "recurring";
  recurrence: ProposalRecurrenceInput | null;
  candidates: ProposalCandidateInput[];
  initialHostUserId: string | null | "suggest";
  foodInvolvement: EventFoodInvolvement | null;
  hostPlaceRequired: boolean;
};

export type ProposalValidationResult =
  | { ok: true; payload: ProposeGroupEventPayload }
  | { ok: false; error: string };

export type RpcProposalCandidate = {
  starts_at: string;
  ends_at: string | null;
};

export type ProposeGroupEventPayload = {
  title: string;
  location: string | null;
  locationCoordinates: EventCoordinates | null;
  notes: string | null;
  recurrence: {
    series_title: string;
    interval_unit: "week" | "month";
    interval_count: number;
    starts_on: string;
    planning_target_date?: string | null;
  } | null;
  candidates: RpcProposalCandidate[];
  setInitialHost: boolean;
  initialHostUserId: string | null;
  foodInvolvement: EventFoodInvolvement | null;
  hostPlaceRequired: boolean;
};

export function candidatesForRpc(
  candidates: ProposalCandidateInput[],
): RpcProposalCandidate[] {
  return candidates.map((candidate) => ({
    starts_at: candidate.startsAt,
    ends_at: candidate.endsAt,
  }));
}

export function parseWallClockCandidate(
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): ProposalCandidateInput | null {
  const dateTrimmed = date.trim();
  const startTrimmed = startTime.trim();
  const endTrimmed = (endTime ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrimmed)) {
    return null;
  }
  if (!/^\d{2}:\d{2}$/.test(startTrimmed)) {
    return null;
  }
  // End time is optional. An empty value means "start only"; anything else must be a valid time.
  if (endTrimmed.length > 0 && !/^\d{2}:\d{2}$/.test(endTrimmed)) {
    return null;
  }

  const startsAt = wallClockToUtcIso(`${dateTrimmed}T${startTrimmed}`, timeZone);
  if (!startsAt) {
    return null;
  }
  if (endTrimmed.length === 0) {
    return { startsAt, endsAt: null };
  }
  const endsAt = wallClockToUtcIso(`${dateTrimmed}T${endTrimmed}`, timeZone);
  if (!endsAt) {
    return null;
  }
  if (validateCandidateWindow(startsAt, endsAt)) {
    return null;
  }
  return { startsAt, endsAt };
}

export function mergeWallClockIntoCandidates(
  candidates: ProposalCandidateInput[],
  parsed: ProposalCandidateInput | null,
): { candidates: ProposalCandidateInput[]; error?: string } {
  if (!parsed) {
    if (candidates.length < 1) {
      return { candidates, error: "Enter a valid date and start time." };
    }
    return { candidates };
  }

  const duplicate = candidates.some(
    (row) => row.startsAt === parsed.startsAt && (row.endsAt ?? null) === parsed.endsAt,
  );
  if (duplicate) {
    return { candidates };
  }

  return { candidates: [...candidates, parsed] };
}

export function validateEventProposalDraft(
  draft: EventProposalDraft,
  options: {
    timeZone: string;
    isFirstGroupEvent: boolean;
    hostingEnabled: boolean;
    memberUserIds: string[];
  },
): ProposalValidationResult {
  const title = normalizeEventTitle(draft.title);
  if (!title) {
    return { ok: false, error: "Enter an event name." };
  }

  const location = normalizeEventLocation(draft.location);
  if (location === null && draft.location.trim().length > 0) {
    return { ok: false, error: "Proposed place is too long." };
  }

  const notes = normalizeEventNotes(draft.notes);
  if (notes === null && draft.notes.trim().length > 0) {
    return { ok: false, error: "Notes are too long." };
  }

  const locationCoordinates = draft.locationCoordinates ?? null;
  if (locationCoordinates !== null && !isValidCoordinates(locationCoordinates)) {
    return { ok: false, error: "Choose a valid spot on the map." };
  }

  const foodInvolvement = parseEventFoodInvolvement(draft.foodInvolvement);
  if (!foodInvolvement) {
    return { ok: false, error: "Say whether food is involved." };
  }

  if (draft.candidates.length < 1) {
    return { ok: false, error: "Add at least one proposed time." };
  }

  const seen = new Set<string>();
  for (const candidate of draft.candidates) {
    const windowError = validateCandidateWindow(candidate.startsAt, candidate.endsAt);
    if (windowError) {
      return { ok: false, error: windowError };
    }
    const key = `${candidate.startsAt}|${candidate.endsAt ?? ""}`;
    if (seen.has(key)) {
      return { ok: false, error: "That time slot is already in your proposal." };
    }
    seen.add(key);
  }

  let recurrence: ProposeGroupEventPayload["recurrence"] = null;
  if (draft.eventKind === "recurring") {
    const seriesTitle = normalizeEventTitle(draft.recurrence?.seriesTitle ?? draft.title);
    const intervalUnit = parseCadenceUnit(draft.recurrence?.intervalUnit ?? "");
    const intervalCount = parseIntervalCount(
      String(draft.recurrence?.intervalCount ?? ""),
    );
    const startsOn = parseStartsOnDate(draft.recurrence?.startsOn ?? "");
    if (!seriesTitle || !intervalUnit || intervalCount === null || !startsOn) {
      return { ok: false, error: "Enter valid recurrence settings." };
    }
    recurrence = {
      series_title: seriesTitle,
      interval_unit: intervalUnit,
      interval_count: intervalCount,
      starts_on: startsOn,
      ...(draft.recurrence?.planningTargetDate
        ? { planning_target_date: draft.recurrence.planningTargetDate }
        : {}),
    };
  }

  let setInitialHost = false;
  let initialHostUserId: string | null = null;
  if (options.isFirstGroupEvent && options.hostingEnabled) {
    if (draft.initialHostUserId === "suggest") {
      setInitialHost = false;
    } else {
      setInitialHost = true;
      if (draft.initialHostUserId !== null) {
        if (!options.memberUserIds.includes(draft.initialHostUserId)) {
          return { ok: false, error: "Choose a valid group member to host." };
        }
        initialHostUserId = draft.initialHostUserId;
      }
    }
  }

  return {
    ok: true,
    payload: {
      title,
      location,
      locationCoordinates,
      notes,
      recurrence,
      candidates: candidatesForRpc(draft.candidates),
      setInitialHost,
      initialHostUserId,
      foodInvolvement,
      hostPlaceRequired: options.hostingEnabled ? draft.hostPlaceRequired : false,
    },
  };
}
