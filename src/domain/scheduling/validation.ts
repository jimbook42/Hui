import { parseOptionalDateTime } from "@/domain/events/validation";

import type { AvailabilityChoice } from "./types";

export function parseRequiredDateTime(raw: string, timeZone?: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseOptionalDateTime(trimmed, timeZone);
}

/**
 * Start is required; end is optional. A missing end is valid (start-only), never a fake duration.
 * Both values are UTC ISO strings, which compare correctly as text.
 */
export function validateCandidateWindow(
  startsAt: string,
  endsAt: string | null | undefined,
): string | null {
  if (endsAt === null || endsAt === undefined) {
    return null;
  }
  if (endsAt <= startsAt) {
    return "End time must be after start time.";
  }
  return null;
}

export function parseAvailabilityChoice(raw: string): AvailabilityChoice | null {
  if (raw === "available" || raw === "unavailable" || raw === "maybe") {
    return raw;
  }
  return null;
}

export function validateAvailabilityChoice(
  choice: AvailabilityChoice,
  maybeResponsesEnabled: boolean,
): string | null {
  if (choice === "maybe" && !maybeResponsesEnabled) {
    return "Maybe responses are not allowed in this group.";
  }
  return null;
}

const PRIVATE_ATTENDANCE_NOTE_MAX = 500;

export function normalizePrivateAttendanceNote(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > PRIVATE_ATTENDANCE_NOTE_MAX) {
    return null;
  }
  return trimmed;
}

export function isDuplicateCandidate(
  existing: { startsAt: string; endsAt: string | null; status: string }[],
  startsAt: string,
  endsAt: string | null,
): boolean {
  return existing.some(
    (row) =>
      (row.status === "proposed" || row.status === "selected") &&
      row.startsAt === startsAt &&
      (row.endsAt ?? null) === (endsAt ?? null),
  );
}
