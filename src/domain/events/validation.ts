import { wallClockToUtcIso } from "@/domain/datetime/timezone";

import type { CadenceUnit, EventKind } from "./types";

const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 160;
const MAX_LOCATION_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

export function normalizeEventTitle(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < MIN_TITLE_LENGTH || trimmed.length > MAX_TITLE_LENGTH) {
    return null;
  }
  return trimmed;
}

export function normalizeOptionalText(
  input: string,
  maxLength: number,
): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    return null;
  }
  return trimmed;
}

export function normalizeEventLocation(input: string): string | null {
  return normalizeOptionalText(input, MAX_LOCATION_LENGTH);
}

export function normalizeEventNotes(input: string): string | null {
  return normalizeOptionalText(input, MAX_NOTES_LENGTH);
}

export function parseEventKind(raw: string): EventKind | null {
  if (raw === "one_off" || raw === "recurring") {
    return raw;
  }
  return null;
}

export function parseCadenceUnit(raw: string): CadenceUnit | null {
  if (raw === "week" || raw === "month") {
    return raw;
  }
  return null;
}

export function parseIntervalCount(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

export function parseStartsOnDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const parsed = Date.parse(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return trimmed;
}

export function parseOptionalDateTime(
  raw: string,
  timeZone?: string,
): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (timeZone) {
    const zoned = wallClockToUtcIso(trimmed, timeZone);
    if (zoned) {
      return zoned;
    }
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}
