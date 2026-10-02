import { parseOptionalDateTime } from "@/domain/events/validation";

import type { AvailabilityChoice } from "./types";

export function parseRequiredDateTime(raw: string, timeZone?: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseOptionalDateTime(trimmed, timeZone);
}

export function validateCandidateWindow(
  startsAt: string,
  endsAt: string,
): string | null {
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

export function isDuplicateCandidate(
  existing: { startsAt: string; endsAt: string; status: string }[],
  startsAt: string,
  endsAt: string,
): boolean {
  return existing.some(
    (row) =>
      (row.status === "proposed" || row.status === "selected") &&
      row.startsAt === startsAt &&
      row.endsAt === endsAt,
  );
}
