import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import {
  normalizeEventLocation,
  normalizeEventNotes,
  normalizeEventTitle,
  parseCadenceUnit,
  parseIntervalCount,
  parseStartsOnDate,
} from "@/domain/events/validation";
import { validateCandidateWindow } from "@/domain/scheduling/validation";

export type ProposalCandidateInput = {
  startsAt: string;
  endsAt: string;
};

export type ProposalRecurrenceInput = {
  seriesTitle: string;
  intervalUnit: "week" | "month";
  intervalCount: number;
  startsOn: string;
};

export type EventProposalDraft = {
  title: string;
  location: string;
  notes: string;
  eventKind: "one_off" | "recurring";
  recurrence: ProposalRecurrenceInput | null;
  candidates: ProposalCandidateInput[];
  initialHostUserId: string | null | "suggest";
};

export type ProposalValidationResult =
  | { ok: true; payload: ProposeGroupEventPayload }
  | { ok: false; error: string };

export type RpcProposalCandidate = {
  starts_at: string;
  ends_at: string;
};

export type ProposeGroupEventPayload = {
  title: string;
  location: string | null;
  notes: string | null;
  recurrence: {
    series_title: string;
    interval_unit: "week" | "month";
    interval_count: number;
    starts_on: string;
  } | null;
  candidates: RpcProposalCandidate[];
  setInitialHost: boolean;
  initialHostUserId: string | null;
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
  const endTrimmed = endTime.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrimmed)) {
    return null;
  }
  if (!/^\d{2}:\d{2}$/.test(startTrimmed) || !/^\d{2}:\d{2}$/.test(endTrimmed)) {
    return null;
  }

  const startsAt = wallClockToUtcIso(`${dateTrimmed}T${startTrimmed}`, timeZone);
  const endsAt = wallClockToUtcIso(`${dateTrimmed}T${endTrimmed}`, timeZone);
  if (!startsAt || !endsAt) {
    return null;
  }
  if (validateCandidateWindow(startsAt, endsAt)) {
    return null;
  }
  return { startsAt, endsAt };
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

  if (draft.candidates.length < 1) {
    return { ok: false, error: "Add at least one proposed time." };
  }

  const seen = new Set<string>();
  for (const candidate of draft.candidates) {
    const windowError = validateCandidateWindow(candidate.startsAt, candidate.endsAt);
    if (windowError) {
      return { ok: false, error: windowError };
    }
    const key = `${candidate.startsAt}|${candidate.endsAt}`;
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
      notes,
      recurrence,
      candidates: candidatesForRpc(draft.candidates),
      setInitialHost,
      initialHostUserId,
    },
  };
}
