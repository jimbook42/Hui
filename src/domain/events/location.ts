/**
 * Hui's own event location model (HUI-026U.3).
 *
 * An event stores a human-readable place (`location`) and, optionally, WGS84 coordinates.
 * This module is provider-independent: it knows nothing about tiles, styles or geocoders.
 */

export type EventCoordinates = {
  lat: number;
  lng: number;
};

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidCoordinates(
  value: { lat: number; lng: number } | null | undefined,
): value is EventCoordinates {
  return Boolean(value) && isValidLatitude(value!.lat) && isValidLongitude(value!.lng);
}

/** Round to ~1 m (6 decimals) so stored pins are tidy and do not imply false precision. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export type CoordinateParseResult =
  | { ok: true; coordinates: EventCoordinates | null }
  | { ok: false; error: string };

/**
 * Parse optional latitude/longitude form values. Both empty means "no pin".
 * One without the other, or out-of-range values, is an error.
 */
export function parseOptionalCoordinates(rawLat: unknown, rawLng: unknown): CoordinateParseResult {
  const lat = parseNumber(rawLat);
  const lng = parseNumber(rawLng);

  const latGiven = !(rawLat === null || rawLat === undefined || String(rawLat).trim() === "");
  const lngGiven = !(rawLng === null || rawLng === undefined || String(rawLng).trim() === "");

  if (!latGiven && !lngGiven) {
    return { ok: true, coordinates: null };
  }
  if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
    return { ok: false, error: "Choose a valid spot on the map." };
  }
  return { ok: true, coordinates: { lat: roundCoordinate(lat), lng: roundCoordinate(lng) } };
}

/** Build the optional coordinates of an event row (both columns must be present). */
export function coordinatesFromRow(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): EventCoordinates | null {
  const parsedLat = parseNumber(lat);
  const parsedLng = parseNumber(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  const coordinates = { lat: parsedLat, lng: parsedLng };
  return isValidCoordinates(coordinates) ? coordinates : null;
}

/** Plain-language description for assistive tech and the map's fallback text. */
export function describeMapLocation(location: string | null | undefined): string {
  const place = location?.trim();
  return place ? `Map showing ${place}` : "Map showing the pinned spot";
}
